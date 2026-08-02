---
phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
plan: 02
subsystem: server
tags: [version-skew, dotnet, action-filter, global-guard, hard-lock, viewmodel-shell]

# Dependency graph
requires:
  - phase: 28-composite-nodes-layer-v8-2-0
    provides: v8.2.0 baseline (framework build/test infrastructure)
provides:
  - ShellVersionGuardFilter IActionFilter (byte-for-byte structural twin of ShellVersionResultFilter)
  - Renamed AddVersionFilters helper co-registering BOTH ShellVersionResultFilter + ShellVersionGuardFilter
  - Global fail-closed enforcement on EVERY controller for GET + POST when X-VMS-Client-Build is present and mismatches
  - Zero new envelope path — reuses ShellExceptionFilter StaleClientException → 400 stale_client mapping shipped since v3.8.0
affects: [29-05 (unit tests for the new filter), 29-07 (parity fixture GET-stale-header 400 branch), 29-11 (docs), 29-12 (release + companion NuGet rebuild)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IActionFilter twin of an IResultFilter — byte-for-byte structural mirror: same DI shape, same VmsVersioningOptions consumption, same 'inert when CurrentBuild is null/empty' posture, same self-registration path via a single dedup-guarded helper"
    - "Reused exception-to-envelope pathway — the guard throws StaleClientException rather than setting context.Result directly, so ShellExceptionFilter (lines 80-87) maps it to the byte-identical 400 stale_client envelope; guarantees wire parity between the new global guard and the pre-existing per-controller Parse(HttpRequest, currentBuild) guard"
    - "Filter co-registration with dedup — a single Configure<MvcOptions> block guards both filter registrations with OfType<TypeFilterAttribute>().Any(f => f.ImplementationType == typeof(X)); dedup is idempotent for the stamp (harmless) but LOAD-BEARING for the guard (double registration would throw twice on a mismatched request)"
    - "Filter ordering by construction — action filters run before result filters in ASP.NET MVC; the guard's OnActionExecuting fires before the stamp's OnResultExecuting with no explicit ordering hint"

key-files:
  created: []
  modified:
    - viewmodel-shell-dotnet/Versioning.cs

key-decisions:
  - "Guard filter chose IActionFilter over middleware — action filters share the ASP.NET exception-filter pipeline, so throwing StaleClientException is caught by the shipped ShellExceptionFilter (mapped to 400 stale_client). Middleware bypasses that layer and would require a duplicate envelope-builder."
  - "Renamed AddVersionResultFilter → AddVersionFilters rather than adding a second helper — a private static rename has zero consumer surface (no shim needed) and keeps ONE self-registration seam."
  - "Guard throws the exception the per-controller Parse overload already throws (StaleClientException(clientBuild, currentBuild)) — reuses the shipped mapping instead of introducing a parallel path that could drift silently."
  - "Preserved ActionPayload<T>.Parse(HttpRequest, currentBuild) overload untouched per SKEW-02 (defense-in-depth layer under the global filter; consumers migrating incrementally keep working)."

patterns-established:
  - "The 'twin filter' pattern: when a new server-side gate belongs alongside an existing shipped filter, use the same DI shape + same inert-when-unset posture + register via the same helper. Applied here to pair ShellVersionGuardFilter with ShellVersionResultFilter; the shape generalizes to any future stamp/guard pairing."
  - "The 'reuse the exception filter mapping' rule: throw a domain exception the shipped ShellExceptionFilter already handles instead of building a parallel envelope pathway; the wire stays byte-identical across every producer of the same envelope."

requirements-completed: [SKEW-01, SKEW-02]

# Metrics
duration: ~10min
completed: 2026-08-02
---

# Phase 29 Plan 02: .NET ShellVersionGuardFilter + AddVersionFilters co-registration Summary

Land the .NET half of the global fail-closed guard: a new `ShellVersionGuardFilter : IActionFilter` (byte-for-byte structural twin of the shipped `ShellVersionResultFilter`) that rejects any request whose `X-VMS-Client-Build` header mismatches the server's current build BEFORE any controller runs, plus a rename/extend of the private self-registration helper (`AddVersionResultFilter` → `AddVersionFilters`) that co-registers both filters from a single call inside `AddVmsShellVersioning`. Consumer adoption stays one line; the per-controller `Parse(HttpRequest, currentBuild)` overload continues to compile and work (SKEW-02 defense-in-depth preserved); the wire envelope is byte-identical to the pre-existing per-controller guard because the new filter throws the same `StaleClientException` that the shipped `ShellExceptionFilter` already maps to `400 stale_client`.

## What was built

Task 1 executed cleanly with no deviations. Three surgical edits to `viewmodel-shell-dotnet/Versioning.cs`:

### (a) New `ShellVersionGuardFilter` class — Versioning.cs lines 78–120

Sealed class implementing `IActionFilter`. Constructor takes `VmsVersioningOptions` (same DI shape as `ShellVersionResultFilter` at lines 51–76). `OnActionExecuting` short-circuits on four branches:

1. `CurrentBuild` null/empty → return (versioning off; behavior byte-identical to a versioning-not-configured app per CONTEXT `<decisions>` additive-posture).
2. `X-VMS-Client-Build` header absent → return (header-less curl still works for agent-driven testing; matches v3.8.0 per-controller `Parse(HttpRequest, currentBuild)` semantics).
3. Header matches `CurrentBuild` → return (happy path).
4. Header mismatch → `throw new StaleClientException(advertised, current)`. Reuses the shipped `ShellExceptionFilter.OnExceptionAsync` mapping (`ShellExceptionFilter.cs` lines 80–87: `StaleClientException` → 400 `stale_client` via `ShellErrorResponse.OfStaleClient(staleEx.Message)`). This is the same exception the per-controller `Parse(HttpRequest, currentBuild)` overload throws — the wire is byte-identical between the two guards.

`OnActionExecuted` is an empty implementation (interface requirement; no post-execute work needed).

Class lands at line 93 (`public sealed class ShellVersionGuardFilter : IActionFilter`). Documentation block above (lines 78–92) explicitly names the SKEW-01 requirement, the twin relationship to `ShellVersionResultFilter`, the four short-circuit branches, and the reused envelope-mapping pathway.

### (b) Renamed + extended `AddVersionResultFilter` → `AddVersionFilters` — Versioning.cs line 213

The private static helper renamed and extended to co-register BOTH filters in a single `Configure<MvcOptions>` block:

```csharp
private static void AddVersionFilters(IServiceCollection services)
{
    services.Configure<MvcOptions>(o =>
    {
        // Result filter (Phase-1 stamp — unchanged).
        bool resultAlready = o.Filters.OfType<TypeFilterAttribute>()
            .Any(f => f.ImplementationType == typeof(ShellVersionResultFilter));
        if (!resultAlready) o.Filters.Add<ShellVersionResultFilter>();

        // Action filter (Phase-2 global guard — new in 9.0.0, SKEW-01).
        bool guardAlready = o.Filters.OfType<TypeFilterAttribute>()
            .Any(f => f.ImplementationType == typeof(ShellVersionGuardFilter));
        if (!guardAlready) o.Filters.Add<ShellVersionGuardFilter>();
    });
}
```

Dedup is `OfType<TypeFilterAttribute>().Any(...ImplementationType == typeof(X))` on BOTH filters. Idempotent for the stamp (harmless if duplicated), load-bearing for the guard (double registration would throw twice on a mismatched request — one 400 stale_client + one uncaught exception in the second run).

### (c) Both `AddVmsShellVersioning` overloads updated

- `AddVmsShellVersioning(this IServiceCollection services, string currentBuild)` at Versioning.cs line 158: call site at line 166 now reads `AddVersionFilters(services);`.
- `AddVmsShellVersioning(this IServiceCollection services)` at Versioning.cs line 189: call site at line 199 now reads `AddVersionFilters(services);`.

Two-line diff; consumer adoption unchanged (still `services.AddVmsShellVersioning()` or `services.AddVmsShellVersioning("<build-id>")`).

## Verification

**`dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` exit code: 0.** Last 3 lines of output:

```
Build succeeded.
    0 Warning(s)
    0 Error(s)
```

**Grep acceptance criteria — all passed:**

| Assertion | Expected | Actual |
|-----------|----------|--------|
| `grep -c 'class ShellVersionGuardFilter' Versioning.cs` | 1 | 1 |
| `grep -c 'public sealed class ShellVersionGuardFilter : IActionFilter' Versioning.cs` | 1 | 1 |
| `grep -c 'AddVersionFilters' Versioning.cs` | ≥3 | 3 (1 def + 2 call sites) |
| `grep -c 'private static void AddVersionFilters(IServiceCollection services)' Versioning.cs` | 1 | 1 |
| `grep -c 'AddVersionFilters(services);' Versioning.cs` | 2 | 2 |
| `grep -c 'AddVersionResultFilter' Versioning.cs` | 0 | 0 (fully renamed, no stragglers) |
| `grep -c 'throw new StaleClientException(advertised, current)' Versioning.cs` | 1 | 1 |
| `grep -c 'ShellVersionResultFilter' Versioning.cs` | ≥ pre-existing count | 12 (class def + TSDoc refs + guard's twin ref + helper's TSDoc + dedup check + registration line — all as expected) |

**Cross-file scope guard — CLEAN:**
- `git status viewmodel-shell-dotnet/ViewModels.cs` → no output (untouched — `ActionPayload<T>.Parse` + `StaleClientException` preserved per SKEW-02).
- `git status viewmodel-shell-dotnet/ShellExceptionFilter.cs` → no output (untouched — the `StaleClientException` → 400 stale_client mapping at lines 80–87 is reused, not modified).
- `git diff --stat` shows exactly 1 file changed (Versioning.cs, 60 insertions / 12 deletions).
- `git diff viewmodel-shell-dotnet/Versioning.cs | grep -E "^\+.*ShellVersionResultFilter|^\-.*ShellVersionResultFilter"` shows changes ONLY in the new guard's TSDoc (twin reference) and the renamed helper's TSDoc/body — the shipped `ShellVersionResultFilter` class body at lines 51–76 is untouched (no `-` or `+` lines inside it).

**Framework regression check:**
`dotnet test viewmodel-shell-dotnet/Tests/Tests.csproj` → `Passed! - Failed: 0, Passed: 451, Skipped: 0, Total: 451`. All shipped `ShellVersionResultFilter` self-registration tests + `Parse(HttpRequest, currentBuild)` guard tests continue to pass — SKEW-02 preservation confirmed.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — this plan modifies behavior (adds a fail-closed gate), not the wire schema. No new endpoints, no new auth paths, no new file access, no schema changes at trust boundaries. The threat register in the plan's `<threat_model>` (T-29-04 through T-29-07) applies as-designed: header spoofing accepted (no elevation vector), DoS mitigated (throw only on actual mismatch, self-limiting by client hard-lock), information disclosure accepted (message echoes back build IDs both sides already publish), filter ordering mitigated (action filters precede result filters by ASP.NET construction).

## Consumer contract

- `services.AddVmsShellVersioning()` and `services.AddVmsShellVersioning("<build-id>")` remain one line. No consumer code change required for adoption.
- Existing `ActionPayload<T>.Parse(HttpRequest, currentBuild)` calls in controllers continue to compile + work (SKEW-02 defense-in-depth). They become redundant under the global filter but are not deprecated.
- New behavior: any controller (including ones using the plain `Parse(actionJson, stateJson)` overload) is now fail-closed against stale-client requests. This is a MAJOR-semver-level behavior change on the server side; opt-out is client-side via `ShellOptions.onVersionSkew:"custom"` (shipped in Plan 29-01).
- Wire envelope: byte-identical to the pre-existing per-controller guard — `HTTP 400` + `{ok: false, errors: [{message: "Stale client: ...", code: "stale_client"}]}`. Zero new fields, zero new error codes.

## Downstream awaited

- **Plan 29-05** adds unit tests for the four short-circuit branches (mismatch throws, absent header passes, empty CurrentBuild inert, match passes) + a self-registration test asserting `services.AddVmsShellVersioning("build-x")` puts exactly ONE `ShellVersionGuardFilter` in the pipeline.
- **Plan 29-07** adds a parity fixture step exercising the guard end-to-end over HTTP on the GET path (the branch pre-9.0.0 could not reach — GETs bypassed the guard entirely) with `expectBodyContains` `"stale_client"` as the coverage tripwire.
- **Plan 29-12** rebuilds + republishes companion NuGet(s) per the core-major-bump rule (AGENTS.md line ~693).

## Self-Check: PASSED

**Files exist:**
- `viewmodel-shell-dotnet/Versioning.cs` — FOUND (228 lines; was 180)
- `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-02-SUMMARY.md` — FOUND (this file)

**Commit exists:**
- `9190c67` (feat(29-02): add ShellVersionGuardFilter + rename AddVersionResultFilter to AddVersionFilters co-registering both filters) — FOUND on main.

**Untouched files verified:**
- `viewmodel-shell-dotnet/ViewModels.cs` — no changes (SKEW-02 preservation).
- `viewmodel-shell-dotnet/ShellExceptionFilter.cs` — no changes (mapping reused, not modified).
- `viewmodel-shell-dotnet/Versioning.cs` `ShellVersionResultFilter` class body (lines 51–76) — no changes (twin class, not modified sibling).
