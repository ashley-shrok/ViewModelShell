---
phase: 07-error-envelope-ok-flag-1-0-0-release-closeout
plan: "01"
subsystem: framework-wire
tags: [error-envelope, ok-flag, typescript, dotnet, tdd]
dependency_graph:
  requires: []
  provides: [UnknownActionError-TS, UnknownActionException-dotnet, ErrorEntry-both, ERR_CODES-TS, ErrorCodes-dotnet, ShellErrorResponse-dotnet, createAction-ok-flag-TS, ShellResponse-ok-flag-dotnet]
  affects: [viewmodel-shell/src/server.ts, viewmodel-shell-dotnet/ViewModels.cs]
tech_stack:
  added: []
  patterns: [conditional-spread-null-omission, errorEnvelope-helper, T1-info-disclosure-mitigation]
key_files:
  created:
    - viewmodel-shell/src/server.test.ts
    - viewmodel-shell-dotnet/Tests/EnvelopeTests.cs
  modified:
    - viewmodel-shell/src/server.ts
    - viewmodel-shell-dotnet/ViewModels.cs
decisions:
  - "ERR_CODES vocabulary locked: parse_error / unknown_action / invalid_tree / uncaught_exception (mirrors .NET ErrorCodes constants byte-for-byte)"
  - "UnknownActionError.actionName (TS) / UnknownActionException.ActionName (.NET) — ActionName/actionName is the public property name for the offending action name (avoids collision with Error.name / Exception.GetType().Name)"
  - "BadRequestError envelope has NO code field (D-08) — absence of code is the distinguishing signal"
  - "T1 mitigation: errorMessageFromUnknownThrow() returns err.message for Error instances, 'Internal server error' for non-Error throws; OfUncaught() uses only ex.Message in .NET"
  - "parseJsonAction now validates 'name' field presence to produce a proper parse_error envelope"
  - "node_modules symlink required in worktree for vitest to run — added as untracked, not committed"
metrics:
  duration: "8m 34s"
  completed_date: "2026-06-07"
  tasks_completed: 2
  files_created: 2
  files_modified: 2
---

# Phase 7 Plan 01: TS + .NET Envelope Types and ok Flag Summary

Both backends now export the framework-owned error envelope types with `ok: true / false` on every response, `UnknownActionError/Exception` for app dispatch handlers, and centralized `createAction` envelope construction for all five failure classes.

## Tasks Completed

| Task | Description | Commit | Tests |
|------|-------------|--------|-------|
| 1 (TDD) | TS envelope + ok flag types and createAction wrapping | f671982 | 32 new cases (32/32) |
| 2 (TDD) | .NET envelope types, Ok flag, UnknownActionException | d3f1f5d | 22 new cases (38/38 total) |

## Confirmed Code Vocabulary

Both backends use these exact strings on the wire — byte-aligned:

| TS constant | .NET constant | Wire string | HTTP status | Notes |
|---|---|---|---|---|
| `ERR_CODES.PARSE` | `ErrorCodes.Parse` | `"parse_error"` | 400 | Malformed / unparseable body |
| `ERR_CODES.UNKNOWN_ACTION` | `ErrorCodes.UnknownAction` | `"unknown_action"` | 400 | App threw `UnknownActionError/Exception` |
| `ERR_CODES.INVALID_TREE` | `ErrorCodes.InvalidTree` | `"invalid_tree"` | 500 | `validateActionNames` violation |
| `ERR_CODES.UNCAUGHT` | `ErrorCodes.Uncaught` | `"uncaught_exception"` | 500 | Unrecognised handler throw |
| (absent) | (absent) | _(no code)_ | 400 | `BadRequestError / BadRequest(...)` per D-08 |

## Public API Additions

### TypeScript (`viewmodel-shell/src/server.ts`)

```typescript
export class UnknownActionError extends Error {
  readonly actionName: string;   // the offending action name
  constructor(actionName: string);
}

export interface ErrorEntry {
  path?: string;    // absent when not applicable
  message: string;
  code?: string;    // absent when not applicable
}

export const ERR_CODES = {
  PARSE: "parse_error",
  UNKNOWN_ACTION: "unknown_action",
  INVALID_TREE: "invalid_tree",
  UNCAUGHT: "uncaught_exception",
} as const;

export type ErrCode = typeof ERR_CODES[keyof typeof ERR_CODES];
```

`createAction` success path now centrally adds `ok: true`: `JSON.stringify({ ok: true, ...result })`.

### .NET (`viewmodel-shell-dotnet/ViewModels.cs`)

```csharp
public record ErrorEntry(
    string Message,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Path = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Code = null
);

public static class ErrorCodes { ... }   // Parse / UnknownAction / InvalidTree / Uncaught

public record ShellErrorResponse(IReadOnlyList<ErrorEntry> Errors, bool Ok = false)
{
    public static ShellErrorResponse OfParseError(string message);
    public static ShellErrorResponse OfBadRequest(string message);    // no code per D-08
    public static ShellErrorResponse OfUnknownAction(string actionName);
    public static ShellErrorResponse OfInvalidTree(string message);
    public static ShellErrorResponse OfUncaught(Exception ex);        // T1: only ex.Message
}

public class UnknownActionException : Exception {
    public string ActionName { get; }   // the offending action name
}
```

`ShellResponse<TState>` gains `bool Ok = true` (no `WhenWritingDefault` — serializes on EVERY response per D-04).

## ok:true Centralization

**TS:** `createAction` success path — `return jsonResponse(JSON.stringify({ ok: true, ...result }), 200)` at `server.ts:497`.

**.NET:** `ShellResponse<TState>` record default parameter `bool Ok = true` at `ViewModels.cs:175` — serializes automatically on every controller response.

## Exception Class Naming

| Backend | Class | Public field for offending name |
|---------|-------|---------------------------------|
| TypeScript | `UnknownActionError` | `actionName: string` (lowercase) |
| .NET | `UnknownActionException` | `ActionName: string` (PascalCase) |

Both avoid collision with `Error.name` (TS) and `Exception.GetType().Name` (.NET).

## T1 Info-Disclosure Mitigation

**TS (`errorMessageFromUnknownThrow`):** Returns `err.message` for `Error` instances; `"Internal server error"` for non-Error throws. Stack traces never reach the wire. Tested by 3 dedicated test cases.

**.NET (`OfUncaught`):** Reads only `ex.Message`. Never calls `ex.ToString()`, `ex.StackTrace`, or `ex.GetType().FullName`. Tested by 2 dedicated test cases asserting absence of `"   at "` and BCL type names in serialized output.

## Test Counts

- **TS vitest:** 206 tests pass, 1 skipped (pre-existing unchanged + 32 new in server.test.ts)
- **.NET xUnit:** 38 tests pass (16 pre-existing ViewTreeValidationTests + 22 new EnvelopeTests)
- **core-globals check:** PASS (index.ts unchanged)
- **dotnet build:** PASS (additive `Ok` parameter doesn't break positional construction in demos)

## Deviations from Plan

**1. [Rule 2 - Bug] Added name validation in parseJsonAction**
- **Found during:** Task 1 GREEN phase — test `JSON body missing _action name field` was returning 200 instead of 400
- **Issue:** `parseJsonAction` was silently returning `name: undefined` when the JSON body lacked a `name` field, allowing the handler to be called with an undefined action name instead of surfacing a parse error
- **Fix:** Added explicit validation `if (typeof parsed.name !== "string" || parsed.name === "")` to throw an Error with a descriptive message, which then flows through the parse-error catch arm
- **Files modified:** `viewmodel-shell/src/server.ts`
- **Commit:** f671982

**2. [Rule 2 - Bug] Fixed multipart Request construction in test helpers**
- **Found during:** Task 1 GREEN phase — `multipartRequest()` using `new FormData()` + `new Request(url, { body: fd })` produced 400 instead of 200 in jsdom vitest environment
- **Issue:** jsdom's `request.formData()` does not properly reconstruct a FormData from a FormData-body Request in the test environment (Node/jsdom doesn't set boundary in content-type the same way browsers do)
- **Fix:** Rewrote `multipartRequest` and `malformedMultipartRequest` helpers to manually construct valid multipart bodies with explicit boundary strings in the Content-Type header
- **Files modified:** `viewmodel-shell/src/server.test.ts`
- **Commit:** f671982

**3. [Rule 2 - Test accuracy] Fixed T1 stack-trace assertion in EnvelopeTests**
- **Found during:** Task 2 GREEN phase — test `OfUncaught_T1_DoesNotLeakStackTrace` incorrectly asserted `DoesNotContain("Inner error with stack", ...)` but `ex.Message` IS "inner error with stack" and should appear
- **Issue:** The test was checking that the message itself wasn't present, but the intent was to check that the STACK TRACE markers (`"   at "`, type names) weren't present. The message from `ex.Message` is correct on the wire.
- **Fix:** Replaced the incorrect assertion with one checking `DoesNotContain("System.InvalidOperationException")` (BCL type name) while asserting `Contains("inner error with stack")` (the message)
- **Files modified:** `viewmodel-shell-dotnet/Tests/EnvelopeTests.cs`
- **Commit:** d3f1f5d

## Known Stubs

None — all new types are fully implemented and wired. No placeholder data.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. The `errorEnvelope` / `ShellErrorResponse` types are purely serialization helpers for the existing response channel. T1 mitigation is tested and locked.

## Self-Check: PASSED

- viewmodel-shell/src/server.ts exists: FOUND
- viewmodel-shell/src/server.test.ts exists: FOUND
- viewmodel-shell-dotnet/ViewModels.cs (modified): FOUND
- viewmodel-shell-dotnet/Tests/EnvelopeTests.cs exists: FOUND
- Commit e91226b (RED TS tests): FOUND
- Commit f671982 (GREEN TS implementation): FOUND
- Commit ac44a5f (RED .NET tests): FOUND
- Commit d3f1f5d (GREEN .NET implementation): FOUND
