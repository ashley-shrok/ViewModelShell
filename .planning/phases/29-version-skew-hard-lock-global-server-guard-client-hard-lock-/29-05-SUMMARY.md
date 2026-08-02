---
phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
plan: 05
subsystem: tests
tags: [version-skew, dotnet, action-filter, xunit, unit-tests, viewmodel-shell]

# Dependency graph
requires:
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    provides: Plan 29-02 shipped ShellVersionGuardFilter + AddVersionFilters helper on Versioning.cs
provides:
  - Executable proof for the four documented short-circuit branches of ShellVersionGuardFilter (mismatch throws / match passes / no-header passes / empty-CurrentBuild inert)
  - Self-registration coverage for BOTH AddVmsShellVersioning overloads (string + no-arg)
  - Load-bearing dedup regression — double-call of AddVmsShellVersioning MUST still yield exactly ONE ShellVersionGuardFilter in the pipeline (a double-registered action filter would throw twice on mismatch → 500 instead of the intended 400 stale_client)
  - MakeActionExecutingContext helper (twin of MakeResultContext) reusable by any future ActionFilter unit test
  - HasVersionGuardFilter helper (twin of HasVersionFilter) reusable by any future guard-registration regression test
affects: [29-07 (parity fixture exercises the same guard over HTTP; this plan covers the unit surface), 29-10 (green-tree gate consumes the expanded suite)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Twin-test pattern: every new filter surface gets a helper twin (MakeActionExecutingContext ↔ MakeResultContext) and a registration-inspection helper twin (HasVersionGuardFilter ↔ HasVersionFilter), placed adjacent in the file so the mirror is immediately visible."
    - "Load-bearing dedup regression pattern: when a helper's dedup guard has ASYMMETRIC consequences (harmless for the stamp, breaking for the guard), a dedicated DoubleCall_DoesNotDoubleRegister test locks the behavior — future refactor cannot silently remove the dedup."
    - "SKEW-02 preservation gate: the pre-existing Parse_HeaderMismatch_ThrowsStaleClient_AndDoesNotDeserializeState and the AddVmsShellVersioning_*_SelfRegistersResultFilter tests were left byte-identical (git diff shows 140 insertions / 0 deletions) — evidence that the per-controller Parse overload continues to work as defense-in-depth."

key-files:
  created: []
  modified:
    - viewmodel-shell-dotnet/Tests/VersioningTests.cs

key-decisions:
  - "Placed MakeActionExecutingContext helper immediately adjacent to MakeResultContext (line 134 vs 125) rather than at a separate 'action-filter helpers' section — matches the file's existing single-block-of-helpers layout at the top of the test class."
  - "Placed HasVersionGuardFilter helper immediately adjacent to HasVersionFilter (line 288 vs 275) — same rationale; the twin relationship is discoverable at a glance."
  - "Used FakeWebHostEnvironment (already declared in the file for the no-arg AddVmsShellVersioning_NoArg_SelfHashesManifestFromWebRoot test) in the AddVmsShellVersioning_NoArg_SelfRegistersGuardFilter test — the no-arg overload requires IWebHostEnvironment DI, so reusing the shipped fake keeps the test hermetic without introducing a duplicate fake."
  - "Kept the '== 1' rather than '>= 1' assertion in HasVersionGuardFilter — the strict-equality is load-bearing for the DoubleCall_DoesNotDoubleRegister test (a >= 1 would silently pass under a double-registration regression)."

patterns-established:
  - "Twin-helper placement convention: when a new filter surface is a byte-for-byte twin of a shipped one (see Plan 29-02's ShellVersionGuardFilter ↔ ShellVersionResultFilter shape), its unit-test helpers land adjacent to the shipped ones in the test file, so the mirror is a diff-reviewer read rather than a grep hunt."
  - "Dedup-regression-test convention: whenever a self-registration helper uses OfType<TypeFilterAttribute>().Any(...) dedup, the test suite carries a DoubleCall test that would fail if the dedup were removed — surfaces the invariant as executable proof."

requirements-completed: [SKEW-01, SKEW-02]

# Metrics
duration: ~8min
completed: 2026-08-02
---

# Phase 29 Plan 05: .NET ShellVersionGuardFilter unit tests + AddVersionFilters self-registration + dedup regression Summary

Land xUnit unit-test coverage for the ShellVersionGuardFilter Plan 29-02 shipped: FOUR filter-behavior tests exercising the four documented short-circuit branches (mismatch throws / match passes / no-header passes / empty-CurrentBuild inert) + THREE self-registration tests proving BOTH AddVmsShellVersioning overloads co-register the guard AND that a double-call cannot silently double-register it. The file's pre-existing tests are byte-identical (git diff shows 140 insertions / 0 deletions) — evidence that the SKEW-02 per-controller `Parse(HttpRequest, currentBuild)` overload continues to work as defense-in-depth under the new global filter.

## What was built

Task 1 executed cleanly with no deviations. Three surgical additions to `viewmodel-shell-dotnet/Tests/VersioningTests.cs`:

### (a) `MakeActionExecutingContext` helper — line 134

Twin of the shipped `MakeResultContext` helper at line 125. Constructs a real `ActionExecutingContext` around an optional pre-built `HttpContext` (so callers can preload the `X-VMS-Client-Build` header before wrapping) with a fresh `ActionContext` (empty `RouteData`, `MvcActionDescriptor` alias used consistently with the rest of the file), an empty `List<IFilterMetadata>`, an empty `Dictionary<string, object?>` for `ActionArguments`, and a bare `object()` controller.

TSDoc above the helper explicitly names the SKEW-01 requirement and the `MakeResultContext` twin relationship so a future reader immediately sees the mirror.

### (b) `HasVersionGuardFilter` helper — line 288

Twin of `HasVersionFilter` at line 275. Same shape: `sp.GetRequiredService<IOptions<MvcOptions>>().Value.Filters.OfType<TypeFilterAttribute>().Count(f => f.ImplementationType == typeof(ShellVersionGuardFilter)) == 1`.

The `== 1` (rather than `>= 1`) is load-bearing for the `DoubleCall_DoesNotDoubleRegister` test — a `>= 1` would silently pass under a double-registration regression. Inline comment at the helper site names this constraint.

### (c) 7 new [Fact] tests at the end of the test class

Placed at lines 333 (first filter test) → 434 (last self-registration test). Two blocks:

**Filter-behavior tests (4):**

| Line | Test | Branch exercised |
|------|------|------------------|
| 333 | `VersionGuardFilter_HeaderMismatch_ThrowsStaleClient` | Header present + mismatches → `StaleClientException(advertised, current)` thrown; asserts `ex.ClientBuild == "old-build"` + `ex.CurrentBuild == "new-build"` (fields carry the same shape the shipped `ShellExceptionFilter` maps to the 400 stale_client envelope). |
| 347 | `VersionGuardFilter_HeaderMatches_PassesThrough` | Header present + matches → no throw; `ctx.Result` remains null (no short-circuit). |
| 360 | `VersionGuardFilter_NoHeader_PassesThrough` | Header absent → no throw; asserts CONTEXT's "agent-driven curl still works" posture matches the shipped `Parse_NoHeader_PassesThrough` sibling test's semantics. |
| 373 | `VersionGuardFilter_EmptyCurrentBuild_SkipsGuard` | `VmsVersioningOptions.CurrentBuild = ""` → inert even against a "mismatching" header; asserts CONTEXT's additive-posture (versioning-off apps are byte-identical to before). |

**Self-registration tests (3):**

| Line | Test | Assertion |
|------|------|-----------|
| 394 | `AddVmsShellVersioning_String_SelfRegistersGuardFilter` | `services.AddVmsShellVersioning("build-x")` → exactly ONE `ShellVersionGuardFilter` in the pipeline. |
| 405 | `AddVmsShellVersioning_NoArg_SelfRegistersGuardFilter` | `services.AddVmsShellVersioning()` (no-arg overload, requires `IWebHostEnvironment` DI — reuses the pre-existing `FakeWebHostEnvironment` from the file) → exactly ONE `ShellVersionGuardFilter`. |
| 418 | `AddVmsShellVersioning_DoubleCall_DoesNotDoubleRegisterGuard` | Calling `AddVmsShellVersioning("build-x")` TWICE → still exactly ONE `ShellVersionGuardFilter`. **Load-bearing:** a double-registered action filter would throw twice on mismatch (the second throw is uncaught by the same `ShellExceptionFilter` pass that mapped the first throw to 400 stale_client), producing a 500 instead of the intended 400 stale_client. This test is the executable proof that the `AddVersionFilters` dedup guard cannot be silently removed by a future refactor. |

Inline comments on each test cite the CONTEXT decision each branch enforces.

## Verification

**`dotnet test viewmodel-shell-dotnet/Tests` exit code: 0.** Final line of output:

```
Passed!  - Failed:     0, Passed:   458, Skipped:     0, Total:   458, Duration: 177 ms - Tests.dll (net9.0)
```

Pre-plan baseline was 451 passing tests; new count is 458 (+7, exact match to the 7 new tests added).

**Framework build clean:** `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` → `0 Warning(s), 0 Error(s)`. (No framework source touched by this plan — Plan 29-02 owns Versioning.cs; this plan is test-only.)

**Grep acceptance criteria — all passed:**

| Assertion | Expected | Actual |
|-----------|----------|--------|
| `grep -c '\[Fact\]' viewmodel-shell-dotnet/Tests/VersioningTests.cs` | pre-plan + 7 = 24 | 24 |
| `grep -c 'ShellVersionGuardFilter' viewmodel-shell-dotnet/Tests/VersioningTests.cs` | ≥ 8 | 11 |
| `grep -c 'MakeActionExecutingContext' viewmodel-shell-dotnet/Tests/VersioningTests.cs` | ≥ 5 (1 def + 4 uses) | 5 |
| `grep -c 'HasVersionGuardFilter' viewmodel-shell-dotnet/Tests/VersioningTests.cs` | ≥ 4 (1 def + 3 uses) | 4 |

**Pre-existing tests untouched — SKEW-02 preservation confirmed:**

`git diff viewmodel-shell-dotnet/Tests/VersioningTests.cs` shows exactly 140 insertions and 0 deletions. Every pre-existing `[Fact]` (including `Parse_HeaderMismatch_ThrowsStaleClient_AndDoesNotDeserializeState` at line 53 and `AddVmsShellVersioning_String_SelfRegistersResultFilter` at line 268) has an unchanged body. The `git diff --stat` confirms: `1 file changed, 140 insertions(+)` — zero deletions.

## Deviations from Plan

None — plan executed exactly as written. All 7 tests + 2 helpers landed per plan spec.

## Threat Flags

None — this plan is test-only; it does not modify wire schema, endpoints, auth paths, file access, or trust boundaries. The threat register in the plan's `<threat_model>` (T-29-14, T-29-15, T-29-16) is DIRECTLY MITIGATED by the tests landed:

- **T-29-14 (Repudiation: double-registration regression)** → `AddVmsShellVersioning_DoubleCall_DoesNotDoubleRegisterGuard` fails loudly if the dedup guard is removed.
- **T-29-15 (Tampering: filter behavior branch collapse)** → four separate tests, one per documented branch — collapsing a branch requires deleting or modifying a test, which surfaces in code review.
- **T-29-16 (Denial of Service: test contexts might not exercise real pipeline)** → accepted; unit tests use `DefaultHttpContext`. Plan 29-07 exercises the guard over a real HTTP request via a parity fixture; the two layers cover both the unit and integration surfaces.

## Consumer contract

- No consumer-facing contract change. This plan adds test coverage only.
- The four documented branches of the guard now have executable proof; the AddVersionFilters helper's dedup is regression-locked.

## Downstream awaited

- **Plan 29-07** exercises the same guard over HTTP via a parity fixture step with `expectBodyContains "stale_client"` as the coverage tripwire — the integration layer complementing this plan's unit layer.
- **Plan 29-10** runs the green-tree gate consuming this expanded suite (458 tests).

## Self-Check: PASSED

**Files exist:**
- `viewmodel-shell-dotnet/Tests/VersioningTests.cs` — FOUND (434 lines; was 294 pre-plan; +140 insertions).
- `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-05-SUMMARY.md` — FOUND (this file).

**Commit exists:**
- `1f92909` (test(29-05): add ShellVersionGuardFilter unit tests + AddVersionFilters self-registration + dedup regression) — FOUND on main.

**ROADMAP.md updated:**
- Line 544: `- [x] 29-05-PLAN.md — .NET ShellVersionGuardFilter + AddVersionFilters unit tests + dedup regression test (wave 2, depends on 29-02)` — checkbox flipped from `[ ]` to `[x]`.
