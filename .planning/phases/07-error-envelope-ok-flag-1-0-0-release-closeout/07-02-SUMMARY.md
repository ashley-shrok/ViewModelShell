---
phase: 07-error-envelope-ok-flag-1-0-0-release-closeout
plan: "02"
subsystem: framework-shell
tags: [error-envelope, ok-flag, VmsActionError, parse-then-branch, d15-hardening, tdd]
dependency_graph:
  requires: [07-01]
  provides: [VmsActionError-export, parse-then-branch-load, parse-then-branch-dispatch, parse-then-branch-push, ShellResponse-ok-field, ShellResponse-errors-field]
  affects: [viewmodel-shell/src/index.ts, viewmodel-shell/test/error-envelope.test.ts]
tech_stack:
  added: []
  patterns: [parse-then-branch, throw-before-write-D15-hardening, summarizeErrors-single-vs-multi]
key_files:
  created:
    - viewmodel-shell/test/error-envelope.test.ts
  modified:
    - viewmodel-shell/src/index.ts
decisions:
  - "ErrorEntry defined locally in index.ts (NOT imported from server.ts) to avoid circular dep — server.ts does export * from index.ts; cross-reference comment added at both definition sites"
  - "summarizeErrors rule: single entry → verbatim message; multiple → 'msg (and N more)' — keeps console.error useful without overwhelming"
  - "VmsActionError.status = 0 for push-originated errors (no HTTP transaction); documented inline"
  - "ok absent in push() body treated as ok:true — backwards compat for hand-constructed legacy push bodies"
metrics:
  duration: "6m 17s"
  completed_date: "2026-06-07"
  tasks_completed: 1
  files_created: 1
  files_modified: 1
---

# Phase 7 Plan 02: VmsActionError + parse-then-branch in load/dispatch/push Summary

Shell-side consumer half of the error envelope contract: `VmsActionError` exported, `load()`/`dispatch()`/`push()` all branch on `body.ok === false` uniformly, D-15 runtime hardening enforced by throw-before-write ordering.

## Tasks Completed

| Task | Description | Commit (RED) | Commit (GREEN) | Tests |
|------|-------------|--------------|----------------|-------|
| 1 (TDD) | VmsActionError + parse-then-branch in load/dispatch/push | 05de9e1 | 1c858c2 | 30 new cases (236/237 total) |

## Implementation Details

### ErrorEntry interface location

`ErrorEntry` is defined **locally in `viewmodel-shell/src/index.ts`** (line 411) rather than imported from `server.ts`. Reason: `server.ts` already does `export * from "./index.js"` — a runtime import in the other direction would create a circular dependency. A comment at both definition sites cross-references the other file so a future reader knows to update both when changing the shape.

### summarizeErrors rule

The private `summarizeErrors()` helper at line 428 implements:
- Single entry → `errors[0].message` verbatim (the overwhelmingly common case)
- Multiple entries → `"${errors[0].message} (and ${errors.length - 1} more)"` — keeps `console.error("[ViewModelShell]", err)` useful for non-VmsActionError-aware consumers without overwhelming

### D-15 Runtime Hardening: Throw-Before-Write Ordering

The key invariant is that `throw new VmsActionError(...)` appears BEFORE any `this.currentVm = body.vm` / `this.currentState = body.state` write. Line proof:

**load() path:**
- Line 526: `if (body.ok === false) { throw new VmsActionError(...) }` ← BEFORE
- Line 535: `this.currentVm = body.vm;` ← AFTER (never reached on ok:false)
- Line 536: `this.currentState = body.state;` ← AFTER (never reached on ok:false)

**dispatch() path:**
- Line 618: `if (body.ok === false) { throw new VmsActionError(...) }` ← BEFORE
- `this.processResponse(body)` at line 631 ← AFTER (never reached on ok:false)
- `processResponse` writes to `currentVm`/`currentState` at lines 764-765 ← unreachable on ok:false

This guarantees D-15 even if the server (incorrectly) sends `{ok: false, errors: [...], vm: <tree>, state: {...}}` — the shell does not consume the vm/state fields.

### Existing load() try/catch as the routing path

The plan confirmed that `load()` already has a try/catch wrapping lines 524-569 (the load body). The `VmsActionError` thrown at line 527 is caught at line 573:
```typescript
} catch (err) {
  const error = err instanceof Error ? err : new Error(String(err));
  onError ? onError(error) : console.error("[ViewModelShell]", error);
```
Since `VmsActionError instanceof Error === true`, it flows through `err instanceof Error ? err` verbatim — the catch wrapper does NOT rewrap it. `await shell.load()` resolves normally (the catch swallows the throw); `onError` fires exactly once. This is the D-13 contract — verified by the "resolves normally" test case.

### New branch site counts

```
grep -c "body.ok === false\|response.ok === false" viewmodel-shell/src/index.ts
```
Returns **3** — one each in load(), dispatch(), push().

### push() — status: 0

Push-originated `VmsActionError` carries `status: 0` because there is no HTTP transaction (the caller feeds a pre-parsed response object; no `fetch()` was involved). Documented inline.

### processResponse() / failCapability() — unchanged

`processResponse()` is not modified. Per D-15, it only ever sees `ok:true` bodies — the `ok:false` branch throws before `processResponse` is called.

`failCapability()` remains a plain `Error` construction. It fires on the SUCCESS path (when an `ok:true` response contains a side-effect the adapter can't service). `VmsActionError` fires on the FAILURE path (`ok:false` envelope). These are mutually exclusive scenarios; both coexist on the same `onError` callback; apps distinguish via `if (err instanceof VmsActionError)`.

## Test Counts

- **vitest (full suite):** 236 tests pass, 1 skipped (pre-existing unchanged)
- **New tests (error-envelope.test.ts):** 30 tests, all pass
- **core-globals check:** PASS — no new platform globals in index.ts
- **Pre-existing tests:** 206/206 pass, 1 skipped (unchanged)

## Acceptance Criteria Verification

```
grep -n "export class VmsActionError" viewmodel-shell/src/index.ts
# Returns: 445:export class VmsActionError extends Error {  ✓ (1 match)

grep -n "body.ok === false\|response.ok === false" viewmodel-shell/src/index.ts
# Returns exactly 3 matches (526, 618, 659) ✓

grep -n "ok?: boolean" viewmodel-shell/src/index.ts
# Returns: 483:  ok?: boolean;  ✓

grep -n "errors?: ErrorEntry\[\]" viewmodel-shell/src/index.ts
# Returns: 485:  errors?: ErrorEntry[];  ✓

grep -n 'if (!res.ok) throw' viewmodel-shell/src/index.ts
# Returns nothing  ✓ (old pattern gone)

npm run check:core-globals
# ✓ AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals.
```

## Deviations from Plan

None — plan executed exactly as written. ErrorEntry was defined locally as the plan recommended ("the safe path is 'duplicate the structurally-identical interface in index.ts'"). The `summarizeErrors` rule matched the plan's recommendation.

## Known Stubs

None — all new types fully implemented. The `placeholder` reference found in a grep is `FieldNode.placeholder` — a legitimate pre-existing wire field, not a stub.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. The changes are within the existing HTTP response handling paths — same trust boundaries as before (network → shell → adapter). T-07-05 and T-07-15 mitigations are implemented: non-JSON body fallback (T-07-05) and throw-before-write ordering (T-07-15), both covered by dedicated test cases.

## Self-Check: PASSED

- viewmodel-shell/src/index.ts modified: FOUND
- viewmodel-shell/test/error-envelope.test.ts created: FOUND
- Commit 05de9e1 (RED test): FOUND
- Commit 1c858c2 (GREEN implementation): FOUND
- 3 `ok === false` branch sites: VERIFIED
- `export class VmsActionError` at line 445: VERIFIED
- `if (!res.ok) throw` count: 0 (VERIFIED gone)
- core-globals check: PASS (VERIFIED)
- Full vitest suite: 236/237 (VERIFIED)
