---
phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
plan: 06
subsystem: testing

tags: [viewmodel-shell, composite-nodes, typed-slots, state-axis, wire-shape, dotnet, twin, serialization, WhenWritingNull, gotcha-8]

# Dependency graph
requires:
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    provides: Plan 27-02 (commit 9fc7c2e) — the 6 trailing-append `[JsonIgnore(WhenWritingNull)] string? State = null` parameters on MessageNode/UserRowNode/DetailRowNode/TimelineEntryNode/SettingRowNode/ChipNode that this plan asserts on.
  - phase: 24-v8-0-composite-nodes-layer-primary
    provides: `ListRowNodeSerializationTests.cs` — the byte-aligned template for JsonSerializerOptions setup (camelCase only, NO host DefaultIgnoreCondition — proves attribute discipline intrinsically), discriminator assertion pattern, and WhenWritingNull absence check pattern.
provides:
  - New consolidated .NET test file `viewmodel-shell-dotnet/Tests/CompositeStateAxisSerializationTests.cs` (14 Facts) covering `state?` axis serialization on all 6 v8.1 composite additions
  - Per-composite `State_OmittedIsAbsent_{Composite}` Facts (×6) proving `null → absent` on the wire (gotcha #8 discipline honored by the attribute-only path, no host DefaultIgnoreCondition)
  - Per-composite `State_SetSerializes_{Composite}` Facts (×6) proving `"active" → "state":"active"` verbatim (freeform round-trip, Q1=B locked decision)
  - Cross-composite `AllSixCompositesOmitStateWhenNull` Fact — class-2 findNulls defense; a solo-composite attribute-strip regression fails with a message naming the offending composite
  - Freeform-value round-trip `RoundTripPreservesArbitraryStateValue_ChipNode` Fact — serialize→deserialize proves the wire preserves unrecognized values; picked Chip because it ships NO --active CSS rule per the phase's "field exists for wire uniformity" deferral
  - .NET test count: 442 pass, 0 fail (428 baseline + 14 new)
affects: [27-07 (parity fixture extension for cross-backend equivalence; this plan's Facts are the .NET half of the same wire discipline), 27-09 (green-tree gate)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AGENTS.md gotcha #8 discipline attribute-only verification: the shipped `JsonSerializerOptions` uses ONLY `PropertyNamingPolicy = JsonNamingPolicy.CamelCase` (no `DefaultIgnoreCondition`). This is a DELIBERATELY STRONGER posture than the plan's initial suggestion — it proves the `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` attributes carry the null-absent contract INTRINSICALLY, so a downstream host that forgets to set `DefaultIgnoreCondition` still gets the correct wire. Matches the byte-aligned template used by every other shipped `*SerializationTests.cs` file in the Tests/ directory (verified: ListRowNodeSerializationTests, ChipNodeSerializationTests, AlertNodeSerializationTests all use the same options block)."
    - "Cross-composite class-2 findNulls defense pattern: one Fact iterates a `(string Name, ViewNode Node)[]` tuple of all 6 minimal-shape composites, asserting NONE emits `\"state\":` on the wire; failure message names the offending composite. This closes the AGENTS.md 'know what a diff can and cannot prove' hole — a solo-composite attribute-strip regression that BOTH twins happen to share (so cross-backend parity would agree and pass) is caught by this Fact alone, without needing a diff."
    - "Freeform round-trip pattern: `Deserialize<ViewNode>(json, _opts)` → `Assert.IsType<ChipNode>` → assert `.State == \"foobar\"` proves the polymorphic discriminator dispatch AND the freeform State value survive a full wire trip. First .NET test in the Tests/ directory to prove both directions on the `state?` axis for a composite that ships NO CSS rule for the value."

key-files:
  created:
    - "viewmodel-shell-dotnet/Tests/CompositeStateAxisSerializationTests.cs (270 lines, 14 [Fact] methods, mirrors ListRowNodeSerializationTests.cs conventions)"
  modified: []

key-decisions:
  - "JsonSerializerOptions posture: camelCase only, NO `DefaultIgnoreCondition` — matches the actually-shipped ListRowNodeSerializationTests.cs template (lines 35-38). The plan's `<interfaces>` block prescribed `DefaultIgnoreCondition = WhenWritingNull` as 'verbatim from ListRowNodeSerializationTests', but reading the file shows the shipped template uses camelCase-only, which is the STRONGER test (proves attribute discipline intrinsically). Followed the shipped code (which the plan's `<action>` also explicitly instructs: 'verbatim from ListRowNodeSerializationTests.cs'). Documented in the file's header comment so a future reader understands why the DefaultIgnoreCondition line is deliberately absent."
  - "Minimum-shape factory pattern: 6 private `Minimal{Composite}()` methods construct the minimum-shape record with State defaulted, reused by both the per-composite `State_OmittedIsAbsent_*` Facts AND the cross-composite Fact. Reduces per-Fact boilerplate and guarantees the cross-composite Fact tests the SAME minimum-shape used by the per-composite Facts (an inconsistency here would be silent, since both paths would still pass — the factories are the single source of truth for 'what a minimum-shape composite looks like on the wire')."
  - "Chip picked for the freeform round-trip Fact because it ships NO --active CSS rule per the phase's 'field exists for wire uniformity' deferral (see ViewModels.cs:2754-2757 comment). This makes the JSON round-trip the SOLE correctness path for Chip's State field — no browser render smoke-tests it end-to-end — so the round-trip Fact is genuinely load-bearing here, not just illustrative."
  - "Each `State_OmittedIsAbsent_*` Fact carries BOTH `Assert.DoesNotContain(\"\\\"state\\\":\", json)` (broader — catches ANY emission of the field) AND `Assert.DoesNotContain(\"\\\"state\\\":null\", json)` (narrower — belt-and-suspenders for the specific null-literal failure mode). The broader assertion would fail first if the attribute were silently stripped, but the narrower one makes the failure message unambiguous about the specific regression mode."
  - "No modification to any other file: the plan's file-isolation invariant held throughout. `git status --short` post-commit showed only the pre-existing plan-directory untracked files and `.vite/` — both present at plan start, neither caused by this plan."

patterns-established:
  - "For a wire-uniformity axis added across multiple composites (as in Plan 27-02): the consolidated test file (1 file, N×2 per-composite Facts + 1 cross-composite Fact + 1 round-trip Fact) is a better shape than N per-composite additions to N existing test files. Rationale: (a) the cross-composite Fact — which is the class-2 findNulls defense — naturally belongs in a single-file consolidated shape (splitting it across N files would either mean N copies of the same Fact or having the Fact 'live' in one arbitrary composite's test file), and (b) the per-composite Facts share a single JsonSerializerOptions field + 6 minimum-shape factories, which is denser than N separate files with N duplicated options blocks. Use this pattern for future axis-uniformity work (e.g. if a `tone?` axis is added to composites currently missing it)."
  - "The 'attribute-only WhenWritingNull posture' verification: use `JsonSerializerOptions` with ONLY `PropertyNamingPolicy = JsonNamingPolicy.CamelCase` (no `DefaultIgnoreCondition`). If a test passes under this stripped-down options block, the `[JsonIgnore(Condition = WhenWritingNull)]` attributes are genuinely carrying the contract — not being propped up by host-side defaults. Matches the shipped template across every `*SerializationTests.cs` file in the Tests/ directory."

requirements-completed: [STATE-AXIS-DOTNET-TESTS]

# Metrics
duration: 6min
completed: 2026-07-31
---

# Phase 27 Plan 06: Composite State-axis .NET serialization tests Summary

**Consolidated 14-Fact .NET serialization test file (`CompositeStateAxisSerializationTests.cs`) proves the 6 new `State` parameters (Plan 27-02) round-trip WhenWritingNull-absent when null and verbatim `"state":"active"` when set — closes the .NET half of the gotcha #8 defense for the v8.1 state-axis uniformity work.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-07-31T00:52:00Z
- **Completed:** 2026-07-31T00:58:00Z
- **Tasks:** 1
- **Files created:** 1
- **Files modified:** 0

## Accomplishments

- Created `viewmodel-shell-dotnet/Tests/CompositeStateAxisSerializationTests.cs` (270 lines, 14 [Fact] methods) — a single consolidated test file covering all 6 new v8.1 composite State params (Message/UserRow/DetailRow/TimelineEntry/SettingRow/Chip) in one place.
- 6 `State_OmittedIsAbsent_{Composite}` Facts prove the WhenWritingNull attribute drops the field on the wire when State is null — using JsonSerializerOptions with camelCase-only (no host DefaultIgnoreCondition), so the attribute discipline is proven INTRINSICALLY. Every one of the 6 asserts `Assert.DoesNotContain("\"state\":", json)` AND `Assert.DoesNotContain("\"state\":null", json)` (broader + narrower defense-in-depth).
- 6 `State_SetSerializes_{Composite}` Facts prove `State: "active"` emits `"state":"active"` verbatim on the wire for each composite. Confirms the trailing-append param is wired into the JSON emit path and camelCase policy renders `State` → `state` correctly.
- 1 `AllSixCompositesOmitStateWhenNull` cross-composite Fact iterates a `(string Name, ViewNode Node)[]` tuple of all 6 minimum-shape composites, asserting NONE emits `"state":` — the class-2 findNulls defense per AGENTS.md gotcha #8. A future refactor that silently strips the WhenWritingNull attribute from ONE composite fails this Fact with a message naming the offending composite.
- 1 `RoundTripPreservesArbitraryStateValue_ChipNode` Fact serializes ChipNode with `State: "foobar"` (an unrecognized value), deserializes via `JsonSerializer.Deserialize<ViewNode>` (polymorphic dispatch through the [JsonDerivedType] discriminator), casts to ChipNode, and asserts `deserialized.State == "foobar"`. Chip picked because it ships NO --active CSS rule per the phase's "field exists for wire uniformity" deferral — the JSON round-trip is the SOLE correctness path.
- `dotnet test viewmodel-shell-dotnet/Tests`: 442 pass, 0 fail, 0 skipped, 150 ms duration (428 baseline + 14 new). Filter-scoped run for the new class: 14 pass, 0 fail, 0 skipped, 57 ms.
- File isolation preserved: `git status --short` post-commit shows only pre-existing plan-directory untracked files (present at plan start) + `.vite/` (dev cache) — no other file was modified by this plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create consolidated .NET serialization test file for 6 new State params** — `3c2a126` (test)

**Plan metadata commit:** _will be created as the final commit in this session (SUMMARY.md + ROADMAP.md update)._

## Files Created/Modified

- `viewmodel-shell-dotnet/Tests/CompositeStateAxisSerializationTests.cs` — NEW file, 270 lines, 14 [Fact] methods. Header comment documents the phase context + the intrinsic-attribute verification rationale. Uses `JsonSerializerOptions` with camelCase-only (no `DefaultIgnoreCondition`) per the shipped template. Six private `Minimal{Composite}()` factories provide minimum-shape construction shared by per-composite + cross-composite Facts.

## Verification Evidence

**Fact count:**

```
$ grep -c '\[Fact\]' viewmodel-shell-dotnet/Tests/CompositeStateAxisSerializationTests.cs
14
```

**Per-Fact-name presence (each of the 12 required per-composite Facts appears exactly once):**

```
State_OmittedIsAbsent_UserRow: 1
State_SetSerializes_UserRow: 1
State_OmittedIsAbsent_Message: 1
State_SetSerializes_Message: 1
State_OmittedIsAbsent_DetailRow: 1
State_SetSerializes_DetailRow: 1
State_OmittedIsAbsent_TimelineEntry: 1
State_SetSerializes_TimelineEntry: 1
State_OmittedIsAbsent_SettingRow: 1
State_SetSerializes_SettingRow: 1
State_OmittedIsAbsent_Chip: 1
State_SetSerializes_Chip: 1
```

**Cross-composite + round-trip Facts present (grep matches ≥2 per acceptance criteria):**

```
$ grep -c 'AllSixCompositesOmitStateWhenNull\|RoundTripPreservesArbitraryStateValue' \
  viewmodel-shell-dotnet/Tests/CompositeStateAxisSerializationTests.cs
3
```

(The 2 unique method names produce 3 grep line matches: the `AllSix…` name appears in the method decl AND is referenced by name inside the failure-message string of one assertion; the `RoundTrip…` appears once in the method decl. All ≥2 as required.)

**Every `State_OmittedIsAbsent_*` Fact uses the broader `\"state\":` DoesNotContain assertion:**

```
$ grep -c 'Assert.DoesNotContain("\\"state\\":"' \
  viewmodel-shell-dotnet/Tests/CompositeStateAxisSerializationTests.cs
6
```

**Every `State_SetSerializes_*` Fact uses the `\"state\":\"active\"` Contains assertion:**

```
$ grep -c 'Assert.Contains("\\"state\\":\\"active\\""' \
  viewmodel-shell-dotnet/Tests/CompositeStateAxisSerializationTests.cs
6
```

**Filter-scoped test run (all 14 new Facts pass):**

```
$ export PATH="$HOME/.dotnet:$PATH" && dotnet test viewmodel-shell-dotnet/Tests \
    --filter 'CompositeStateAxisSerializationTests' --nologo -v minimal
...
Passed!  - Failed:     0, Passed:    14, Skipped:     0, Total:    14, Duration: 57 ms - Tests.dll (net9.0)
```

**Full test-suite run (428 baseline + 14 new = 442 total, all pass):**

```
$ export PATH="$HOME/.dotnet:$PATH" && dotnet test viewmodel-shell-dotnet/Tests --nologo -v minimal
...
Passed!  - Failed:     0, Passed:   442, Skipped:     0, Total:   442, Duration: 150 ms - Tests.dll (net9.0)
```

**File isolation (post-task-commit):**

```
$ git status --short
?? .planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/.gitkeep
?? .planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-01-PLAN.md
… (10 more pre-existing plan files, present at plan start)
?? .vite/ (dev cache, present at plan start)
```

Only `viewmodel-shell-dotnet/Tests/CompositeStateAxisSerializationTests.cs` was created by this task and staged + committed in `3c2a126`. The remaining categories were all present at plan start.

**Post-commit deletion check (no accidental deletions):**

```
$ git diff --diff-filter=D --name-only HEAD~1 HEAD
(empty)
```

## Decisions Made

- **JsonSerializerOptions shape:** followed the shipped `ListRowNodeSerializationTests.cs` template exactly (camelCase-only, NO `DefaultIgnoreCondition`), which is a STRONGER posture than the plan's `<interfaces>` block prescribed. This proves the `[JsonIgnore(WhenWritingNull)]` attribute discipline INTRINSICALLY — a downstream host that forgets to set `DefaultIgnoreCondition` still gets the correct wire posture. Documented the rationale in the file's header comment so a future reader understands why the DefaultIgnoreCondition line is deliberately absent.
- **6 private `Minimal{Composite}()` factories** at the top of the class, reused by both the per-composite `State_OmittedIsAbsent_*` Facts and the cross-composite `AllSixCompositesOmitStateWhenNull` Fact. Single source of truth for "what a minimum-shape composite looks like on the wire" — an inconsistency between the two Fact paths would otherwise be silent (both paths would still pass with divergent shapes).
- **Chip picked for the round-trip Fact** because it is the composite whose State field ships NO --active CSS rule per the phase's "field exists for wire uniformity" deferral (see ViewModels.cs:2754-2757). Makes the JSON round-trip genuinely load-bearing rather than illustrative.
- **Broader + narrower Assert pattern on every `State_OmittedIsAbsent_*` Fact**: BOTH `Assert.DoesNotContain("\"state\":", json)` (catches any emission of the field) AND `Assert.DoesNotContain("\"state\":null", json)` (belt-and-suspenders for the specific null-literal regression). The broader would fire first, but the narrower makes the failure message unambiguous.

## Deviations from Plan

None — plan executed exactly as written.

The one intentional divergence from the plan's `<interfaces>` block (JsonSerializerOptions posture) is NOT a deviation — the plan's `<action>` says "verbatim from ListRowNodeSerializationTests.cs", and the shipped ListRowNodeSerializationTests.cs uses camelCase-only. The plan's `<interfaces>` prose block had a stale prescription; the plan's `<action>` was the authoritative directive and was followed exactly. Documented in the file's header comment + in "Decisions Made" above.

## Issues Encountered

None. Task 1 executed cleanly on the first pass: file written, filter-scoped test run passed 14/14 on the first invocation, full-suite run passed 442/442 on the first invocation, no rework needed.

## User Setup Required

None — no external service configuration required. Purely a .NET test-file addition + local build/test verification.

## Next Phase Readiness

- **27-07** (parity fixture extension for cross-backend equivalence): the .NET half of the gotcha #8 wire discipline is now verified in-tree (14 Facts pass). The parity fixtures downstream can now compare .NET-emitted state values against TS-emitted state values with confidence that the .NET side is honoring the attribute contract intrinsically. Class-2 findNulls defense in place for future cross-backend audits.
- **27-09** (green-tree gate): the framework Tests project stays green (442 passed, 0 failed), so this plan does not block the release-gate suite.
- No blockers. Test-only additions; no runtime behavior change; no companion NuGet rebuild required (MINOR bump, additive optional wire fields already landed in 27-02).

## Self-Check: PASSED

Verified after write:

- **File exists:** `viewmodel-shell-dotnet/Tests/CompositeStateAxisSerializationTests.cs` (270 lines, 14 [Fact] methods).
- **Commit exists:** `3c2a126` (verified via `git rev-parse --short HEAD` and `git log --oneline -1` immediately post-commit).
- **14/14 Facts pass** under `dotnet test --filter 'CompositeStateAxisSerializationTests'`.
- **442/442 total tests pass** under `dotnet test viewmodel-shell-dotnet/Tests` (428 baseline + 14 new).
- **All acceptance-criteria greps satisfied** (Fact count = 14, all 12 required per-composite Fact names present exactly once, cross-composite + round-trip Facts present, correct assertion patterns used).
- **No other file modified** — `git status --short` post-commit shows only pre-existing untracked files (plan directory + `.vite/`).
- **No deletions** — `git diff --diff-filter=D --name-only HEAD~1 HEAD` is empty.

---
*Phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a*
*Completed: 2026-07-31*
