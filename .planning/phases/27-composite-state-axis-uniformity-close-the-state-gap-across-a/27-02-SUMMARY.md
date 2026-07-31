---
phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
plan: 02
subsystem: wire

tags: [viewmodel-shell, composite-nodes, typed-slots, state-axis, wire-shape, dotnet, twin]

# Dependency graph
requires:
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    provides: The 6 TS composite interfaces (Plan 27-01, commit ea41115) that this plan mirrors on the .NET side; the shipped ListRowNode.State record parameter at ViewModels.cs:2185-2188 that serves as the golden template.
  - phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip
    provides: The 6 Phase-25 composite records in ViewModels.cs (UserRowNode, MessageNode, DetailRowNode, TimelineEntryNode, SettingRowNode, ChipNode) whose primary constructors this plan extends with a trailing `State` parameter.
provides:
  - Six new trailing-append `[JsonIgnore(WhenWritingNull)] string? State = null` parameters on the 6 v8 composite records in viewmodel-shell-dotnet/ViewModels.cs
  - Byte-identical wire posture to TS: `undefined → absent` on TS matches `null → absent` on .NET (WhenWritingNull attribute per gotcha #8)
  - Wire uniformity closed on the .NET side: 8 of 8 row/list/composite .NET records now carry the State axis (2 pre-existing at TableRow :1858 + ListRowNode :2188; 6 new here)
  - Per-composite XML comments matching the golden ListRowNode.State style: composite-specific note + `Emits .vms-{composite}--{state}` BEM statement; ChipNode's comment explicitly documents the "ship field, no rule" deferral
affects: [27-03 (browser.ts emission — file-disjoint but wave-2 depends on TS 27-01), 27-04 (default.css unification pass), 27-06 (consolidated .NET serialization tests for the 6 new State params + findNulls defense), 27-07 (parity fixture extension exercising state:"active" across all 8 composites on both twins)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AGENTS.md 'trailing-append zero-retype convention' — a new positional parameter with a default value appended to a C# record's primary ctor preserves source-compat within-tree; a MINOR bump does not trigger the AGENTS.md 'companion rebuild storm' rule (that rule fires only on MAJOR bumps, per AshleyShrok.ViewModelShell.Markdown compat posture)"
    - "AGENTS.md gotcha #8 discipline — every nullable framework wire member carries `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`; matches TS twin's `undefined → absent` posture and closes class-2 findNulls parity holes"

key-files:
  created: []
  modified:
    - "viewmodel-shell-dotnet/ViewModels.cs (6 new trailing `State` parameters on UserRowNode/MessageNode/DetailRowNode/TimelineEntryNode/SettingRowNode/ChipNode records, +28 lines / -6 lines net)"

key-decisions:
  - "Per-composite XML comment shape mirrors the ListRowNode.State golden template at :2185-2188 — inline `//` comment (NOT `///` XML doc), 2-3 lines, semantic-vs-severity clarification + `Emits .vms-{composite}--{state}` BEM statement. Composite-specific notes lifted verbatim from the plan (UserRow/SettingRow: `no tone axis`; DetailRow/TimelineEntry: `NOT severity — that's Tone`; Message: `NOT role — that's Role for surface tint` + `composes multiplicatively with Role`; Timeline: `Composes with the shipped ::before rail-dot mechanism`; Chip: `framework ships NO --active rule for Chip (deferred, see design of record); field exists for wire uniformity`)."
  - "Trailing-append placement: State is the LAST positional parameter of each modified record's primary ctor (`) : ViewNode;` immediately follows the new `State = null` line for all 6 records). This matches the existing TableRow.State (:1858) and ListRowNode.State (:2188) precedent, and satisfies the AGENTS.md 'trailing-append zero-retype convention' — a source-compat guarantee for within-tree consumers, and (per the AGENTS.md MINOR-vs-MAJOR distinction) no companion NuGet rebuild is required because this is a MINOR bump (8.0.0 → 8.1.0)."
  - "No changes to any other .cs / .ts / .css / .md file in this task — the plan's file-isolation invariant held throughout. `git status --short` immediately post-edit and pre-commit showed only `M viewmodel-shell-dotnet/ViewModels.cs`."

patterns-established:
  - "Adding a wire-uniformity axis field to a .NET composite record: (1) append as trailing positional param with default value (source-compat convention); (2) carry `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` attribute (gotcha #8 defense against null-vs-absent parity drift); (3) use inline `//` comment matching the closest sibling composite's convention, not `///` XML doc; (4) name the emitted BEM class in the comment so downstream browser.ts + CSS work has an inline reference."

requirements-completed: [STATE-AXIS-DOTNET]

# Metrics
duration: 4min
completed: 2026-07-31
---

# Phase 27 Plan 02: Composite state axis .NET wire uniformity Summary

**Added trailing-append `[JsonIgnore(WhenWritingNull)] string? State = null` parameter to 6 .NET composite records (UserRow/Message/DetailRow/TimelineEntry/SettingRow/Chip) in ViewModels.cs, closing the typed-slots pattern gap on the .NET side — 8 of 8 row/list composite records now carry the State axis, byte-identical wire posture to the TS twin.**

## Performance

- **Duration:** ~4 min (214 sec)
- **Started:** 2026-07-31T00:05:35Z
- **Completed:** 2026-07-31T00:09:09Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Six new `State` parameters appended to `UserRowNode`, `MessageNode`, `DetailRowNode`, `TimelineEntryNode`, `SettingRowNode`, and `ChipNode` primary constructors in `viewmodel-shell-dotnet/ViewModels.cs` — closing the typed-slots pattern gap on the .NET side.
- Every added parameter carries the mandatory `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` attribute per AGENTS.md gotcha #8 — matches the TS twin's `undefined → absent` posture, so `null` never appears on the wire (defense against class-2 findNulls parity drift).
- Composite-specific inline `//` comments landed as prescribed: **UserRow / SettingRow** ("no tone axis"), **DetailRow** ("NOT severity — that's Tone"), **Message** ("NOT role — that's Role for surface tint; composes multiplicatively with Role"), **TimelineEntry** ("Composes with the shipped ::before rail-dot mechanism"), **Chip** ("framework ships NO --active rule for Chip (deferred, see design of record); field exists for wire uniformity"). Each comment names the emitted BEM class (`.vms-{composite}--{state}`) for downstream reference.
- Trailing-append position: the new `State` parameter is the LAST positional parameter of each modified record's primary ctor. `) : ViewNode;` immediately follows the `State = null` line for every one of the 6 records — mirrors the TableRow.State (:1858) and ListRowNode.State (:2188) precedent, honors the AGENTS.md "trailing-append zero-retype convention", and requires no companion NuGet rebuild since this is a MINOR bump (8.0.0 → 8.1.0).
- `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` succeeds: 0 errors, 0 warnings.
- `dotnet test viewmodel-shell-dotnet/Tests/Tests.csproj` succeeds: 428 passed, 0 failed, 0 skipped, 140 ms duration — additive optional param, no test broke.
- Acceptance-criteria greps all pass: `grep -c 'string? State = null'` = 8 (2 pre-existing + 6 new); the ChipNode State comment contains both "deferred" and "NO --active"; `git status --short` post-edit showed only `M viewmodel-shell-dotnet/ViewModels.cs`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Append State parameter to 6 .NET composite records with WhenWritingNull** — `9fc7c2e` (feat)

**Insertion sites (post-edit line numbers):**

| Composite         | Record line | New `State` line | Placement                                             |
|-------------------|------------:|-----------------:|--------------------------------------------------------|
| MessageNode       |        2222 |             2251 | After `Actions`, LAST param (no `Action` on MessageNode) |
| UserRowNode       |        2396 |             2420 | After `Action`, LAST param                             |
| DetailRowNode     |        2456 |             2479 | After `Icon`, LAST param                               |
| TimelineEntryNode |        2565 |             2589 | After `Icon`, LAST param                               |
| SettingRowNode    |        2650 |             2684 | After `Action`, LAST param                             |
| ChipNode          |        2730 |             2757 | After `Action`, LAST param                             |

Existing `State` param occurrences (unchanged):

- Line 1858 — `TableRow.State` (existing; original trailing-append precedent)
- Line 2188 — `ListRowNode.State` (existing; the golden template)

**Plan metadata commit:** _will be created as the final commit in this session (SUMMARY.md + ROADMAP.md)_

## Files Created/Modified

- `viewmodel-shell-dotnet/ViewModels.cs` — 6 new trailing-append `State` parameters added to composite records, each with WhenWritingNull attribute. +28 lines / -6 lines net (6 old closing-comma changes + 22 new lines of param declaration and comment). No other logic changed.

## Verification Evidence

**Grep verification (after edits):**

```
$ cd /home/thenasty/ViewModelShell && grep -c 'string? State = null' viewmodel-shell-dotnet/ViewModels.cs
8

$ cd /home/thenasty/ViewModelShell && grep -n 'string? State = null' viewmodel-shell-dotnet/ViewModels.cs
1858:    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null,    # TableRow (existing)
2188:    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null,    # ListRowNode (existing)
2251:    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null     # MessageNode (new)
2420:    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null     # UserRowNode (new)
2479:    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null     # DetailRowNode (new)
2589:    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null     # TimelineEntryNode (new)
2684:    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null     # SettingRowNode (new)
2757:    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null     # ChipNode (new)
```

Note: the trailing `,` on lines 1858 and 2188 is because those records have parameters AFTER `State` (per the original Phase 24 authoring — ListRowNode's `State` param at :2188 is followed by `Action` at :2192). The 6 new occurrences (lines 2251, 2420, 2479, 2589, 2684, 2757) carry NO trailing comma because `State` is the LAST param — verified by the immediately-following `) : ViewNode;` line for each.

**Every new `State` param carries WhenWritingNull:**

```
$ cd /home/thenasty/ViewModelShell && grep -B1 'string? State = null' viewmodel-shell-dotnet/ViewModels.cs | grep -c 'WhenWritingNull'
8
```

**ChipNode State comment contains the "deferred" + "no --active" sentinel:**

```
$ cd /home/thenasty/ViewModelShell && awk '/^public record ChipNode/,/^\) : ViewNode;/' viewmodel-shell-dotnet/ViewModels.cs | grep -Ec '(deferred|NO --active)'
2
```

**Build verification:**

```
$ export PATH="$HOME/.dotnet:$PATH" && dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj --nologo -v minimal
  Determining projects to restore...
  All projects are up-to-date for restore.
  AshleyShrok.ViewModelShell -> /home/thenasty/ViewModelShell/viewmodel-shell-dotnet/bin/Debug/net8.0/AshleyShrok.ViewModelShell.dll

Build succeeded.
    0 Warning(s)
    0 Error(s)

Time Elapsed 00:00:01.54
```

**Test verification (framework's own Tests project — the one that was uncompilable 3.0.0-3.3.0 per AGENTS.md; runs 428 tests including per-composite serialization suites):**

```
$ export PATH="$HOME/.dotnet:$PATH" && dotnet test viewmodel-shell-dotnet/Tests/Tests.csproj --nologo -v minimal
...
Passed!  - Failed:     0, Passed:   428, Skipped:     0, Total:   428, Duration: 140 ms - Tests.dll (net9.0)
```

Existing per-composite serialization test suites for the 6 modified records (`MessageNodeSerializationTests.cs`, `UserRowNodeSerializationTests.cs`, `DetailRowNodeSerializationTests.cs`, `TimelineEntryNodeSerializationTests.cs`, `SettingRowNodeSerializationTests.cs`, `ChipNodeSerializationTests.cs`) all pass under the extended primary ctor — the trailing-append default-value convention preserved every existing constructor call site. Plan 27-06 adds explicit tests for the new State param's WhenWritingNull round-trip semantics.

**File isolation (post-task-commit, pre-SUMMARY commit):**

```
$ git status --short
?? .planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/... (pre-existing untracked plan files from phase directory)
?? .vite/ (pre-existing dev cache)
```

Only `viewmodel-shell-dotnet/ViewModels.cs` was modified by this task and it was staged + committed in `9fc7c2e`. The two remaining categories above were already present at plan start (the plan directory + `.vite/`) and are not caused by this plan.

**Wire posture verification (via per-record inspection):**

Each of the 6 new `State` params:
- Is a nullable-string type (`string? State`) with default value `null` — matches TS `state?: string` optionality
- Carries `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` — so `null` renders as ABSENT on the wire (matching TS `undefined → absent`)
- Is the LAST positional param of its record's primary ctor (verified: `) : ViewNode;` immediately follows each new `State = null` line)
- Is placed inside the primary constructor parameter list (not the record body), enabling positional construction and honoring the source-compat trailing-append convention

## Per-Composite Comment Text (as written)

Each verbatim inline comment (adapted from the plan's exact text). All use `//` inline comments (matching the closest sibling composite convention on that record), not `///` XML doc:

**MessageNode** (`viewmodel-shell-dotnet/ViewModels.cs:2248-2250`, immediately preceding line 2251):

```csharp
// Message lifecycle STATE (NOT role — that's Role for surface tint).
// Framework ships active/done/disabled; composes multiplicatively with Role.
// Emits .vms-message--{state}.
[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null
```

**UserRowNode** (`viewmodel-shell-dotnet/ViewModels.cs:2418-2419`):

```csharp
// Row lifecycle STATE (NOT severity — user rows have no tone axis).
// Freeform token; framework ships active/done/disabled. Emits .vms-user-row--{state}.
[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null
```

**DetailRowNode** (`viewmodel-shell-dotnet/ViewModels.cs:2477-2478`):

```csharp
// Row lifecycle STATE (NOT severity — that's Tone). Freeform token;
// framework ships active/done/disabled. Emits .vms-detail-row--{state}.
[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null
```

**TimelineEntryNode** (`viewmodel-shell-dotnet/ViewModels.cs:2586-2588`):

```csharp
// Entry lifecycle STATE (NOT severity — that's Tone). Freeform token;
// framework ships active/done/disabled. Emits .vms-timeline-entry--{state}.
// Composes with the shipped ::before rail-dot mechanism (see default.css).
[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null
```

**SettingRowNode** (`viewmodel-shell-dotnet/ViewModels.cs:2681-2683`):

```csharp
// Row lifecycle STATE (NOT severity — setting rows have no tone axis).
// Freeform token; framework ships active/done/disabled.
// Emits .vms-setting-row--{state}.
[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null
```

**ChipNode** (`viewmodel-shell-dotnet/ViewModels.cs:2754-2756`):

```csharp
// Chip lifecycle STATE (NOT severity — that's Tone). Freeform token;
// framework ships NO --active rule for Chip (deferred, see design of
// record); field exists for wire uniformity. Emits .vms-chip--{state}.
[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? State = null
```

## Decisions Made

- **Placement rule:** trailing-append (LAST positional param) for every one of the 6 records, matching the TableRow.State (:1858) and ListRowNode.State (:2188) precedent. This is the AGENTS.md "trailing-append zero-retype convention" — a source-compat guarantee within-tree; no existing constructor call site needed to change.
- **Attribute rule (gotcha #8):** every new `State` param carries `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` unconditionally, not just as a stylistic mirror of ListRowNode.State but as the load-bearing wire discipline that keeps `null → absent` (matching TS `undefined → absent`) and closes class-2 findNulls parity drift.
- **Comment style:** inline `//` (2-3 lines) matching the ListRowNode.State golden template style at :2185-2188, NOT `///` XML doc. Each comment (a) clarifies State vs. severity/role (composite-specific), (b) names the framework-shipped state vocabulary where applicable, and (c) records the emitted BEM class (`.vms-{composite}--{state}`) so a downstream planner working on browser.ts (27-03) or default.css (27-04) has an inline reference at the type definition.
- **No changes elsewhere:** the plan explicitly restricted the task to `viewmodel-shell-dotnet/ViewModels.cs` — downstream .NET serialization tests are Plan 27-06; parity fixture extensions are Plan 27-07; CSS rule additions are Plan 27-04.

## Deviations from Plan

None — plan executed exactly as written.

Every step matches the plan's task action + acceptance criteria: 6 records modified, State trailing-append with WhenWritingNull attribute, ChipNode's "deferred / NO --active" comment landed verbatim, build + tests green, file isolation preserved.

## Issues Encountered

None. Task 1 executed cleanly on the first pass; all 6 edits succeeded, `dotnet build` was clean on the first invocation, `dotnet test` returned 428/428 passing on the first invocation.

## User Setup Required

None — no external service configuration required. Purely a wire-shape .NET source edit + local build/test verification.

## Next Phase Readiness

- **27-03** (browser.ts renderer emission) can proceed — needs the TS additions from 27-01 (already landed at ea41115) but is file-disjoint from this plan. The 6 new .NET State params on the wire are irrelevant to browser.ts emission (which reads only the JSON payload), so this plan's completion neither blocks nor unblocks 27-03.
- **27-06** (consolidated .NET serialization tests for the 6 new State params + findNulls defense) can now proceed against the extended record shapes; this is the direct downstream of 27-02.
- **27-07** (parity fixture extension for state:"active" across both twins) is downstream of 27-01 + 27-02 + 27-03 + 27-04 — this plan closes the .NET half of its dependency set.
- No blockers. Additive optional wire fields — protocol token stays `viewmodel-shell/1.0`; no consumer break; no MAJOR bump required; no companion NuGet rebuild storm (AGENTS.md "companion rebuild = MAJOR bump only" rule does not fire on 8.0.0 → 8.1.0).

## Self-Check: PASSED

Verified after write:

- **File exists:** `.planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-02-SUMMARY.md` (this file — will be verified via `[ -f ... ]` after write).
- **Commit exists:** `9fc7c2e` (verified via `git rev-parse --short HEAD` and `git log --oneline -1` immediately post-commit).
- **`viewmodel-shell-dotnet/ViewModels.cs` compiles successfully** — `dotnet build` clean (0/0).
- **All 428 existing framework tests pass** — `dotnet test` green.
- **All 6 new `State` params carry `WhenWritingNull`** — grep confirmed.
- **All 6 new `State` params are the LAST positional param of their record's primary ctor** — verified by immediately-following `) : ViewNode;` line in each of the 6 sites.

---
*Phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a*
*Completed: 2026-07-31*
