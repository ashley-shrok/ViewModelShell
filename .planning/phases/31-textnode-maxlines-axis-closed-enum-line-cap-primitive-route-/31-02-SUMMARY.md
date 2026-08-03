---
phase: 31-textnode-maxlines-axis-closed-enum-line-cap-primitive-route-
plan: 02
subsystem: viewmodel-shell-dotnet
tags: [textnode, maxLines, .net, wire-parity, gotcha-8, init-only-property, binary-compat]
requires:
  - "AGENTS.md gotcha #8 — nullable wire fields carry [JsonIgnore(WhenWritingNull)]"
  - "AGENTS.md 'companion NuGet binary-compat' rule — positional-ctor-append is binary-breaking"
  - "parity/check-companion-binary-compat.sh gate — packs core + Markdown, tests packed IL against packed core"
  - "byte-parallel test precedent: viewmodel-shell-dotnet/Tests/TextWeightSerializationTests.cs"
provides:
  - "TextNode.MaxLines int? init-only property on the .NET record"
  - "WhenWritingNull absent-vs-null wire contract on the new field"
  - "Serialization test suite (7 tests) covering emission per value, absence when unset, composition, round-trip"
  - "Byte-parallel .NET half of Route A maxLines axis (paired with Plan 31-01 TS half)"
affects:
  - "viewmodel-shell-dotnet/ViewModels.cs — TextNode record body extended with init-only property"
  - "viewmodel-shell-dotnet/Tests/ — new TextMaxLinesSerializationTests.cs file"
tech-stack:
  added: []
  patterns:
    - "init-only property outside primary ctor (binary-compat-safe placement)"
    - "[JsonIgnore(WhenWritingNull)] on nullable wire fields (gotcha #8)"
    - "closed-enum axis specified on TS side only ('closed unions enforced on ONE side only' documented invariant)"
key-files:
  created:
    - viewmodel-shell-dotnet/Tests/TextMaxLinesSerializationTests.cs
  modified:
    - viewmodel-shell-dotnet/ViewModels.cs
decisions:
  - "Placed MaxLines as init-only property OUTSIDE the primary ctor (not as an appended positional param) — preserves 7-param ctor arity, keeps Markdown 0.2.x's packed IL resolving, honors MINOR-bump binary-compat discipline (AGENTS.md 'companion NuGet binary-compat' rule + parity/check-companion-binary-compat.sh gate)"
  - ".NET emits int? unvalidated — no [Range(1,3)] attribute, no enum type. TS side owns the closed-union spec per AGENTS.md 'closed unions enforced on ONE side only' documented invariant"
  - "Direct-assertion of Assert.DoesNotContain in absence tests — the class-2 gotcha #8 defense the parity normalize step structurally cannot see"
metrics:
  duration: "~25min"
  completed: "2026-08-03"
  files_created: 1
  files_modified: 1
  tests_added: 7
  tasks: 1
---

# Phase 31 Plan 02: TextNode.MaxLines axis — .NET wire + serialization tests Summary

.NET half of the Route A `TextNode.maxLines` axis: added `int? MaxLines` as an init-only property outside the primary ctor with `[JsonIgnore(WhenWritingNull)]` per gotcha #8, plus a 7-test xUnit serialization suite proving emission per value (1/2/3), absence when unset (both defaulted-null and explicit-null), composition with Style/Tone/Weight axes, and round-trip preservation. The property placement is load-bearing — it preserves binary compat with pre-9.2.0 companion NuGet assemblies (Markdown 0.2.x).

## Objective (from PLAN.md)

Add the .NET twin of the `TextNode.maxLines` axis: `int? MaxLines` as an **init-only property outside the primary ctor** on the TextNode record with `[JsonIgnore(WhenWritingNull)]`, and a byte-parallel xUnit serialization suite proving the wire posture.

## Files Modified

### `viewmodel-shell-dotnet/ViewModels.cs`

Added the `MaxLines` init-only property to the `TextNode` record body block, positioned between the primary ctor's `) : ViewNode\n{` (line 1774) and the existing `FromRuns` static factory method. The primary ctor was NOT modified — it remains at 7 positional parameters exactly as before.

- Insertion location: lines 1776-1808 (33 new lines: 30 lines of doc comment + 2 lines of attribute + property declaration + trailing blank line)
- Property declaration at line 1807: `public int? MaxLines { get; init; }`
- Attribute at line 1806: `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`
- Existing `FromRuns` factory (now at ~line 1810) is byte-identical

The 30-line doc comment inline explains:
- The init-only-property-outside-primary-ctor placement rationale (with reference to AGENTS.md's "companion NuGet binary-compat" rule)
- Consumer construction syntax (`{ MaxLines = N }` or `with { MaxLines = N }`, NOT positional `MaxLines: N`)
- Wire posture (WhenWritingNull ⇒ absent when null)
- Range specification (TS-side closed union; .NET emits int? unvalidated per "closed unions enforced on ONE side only")
- CSS class emission (`.vms-text--max-lines-{N}` via BrowserAdapter — Plan 31-01's territory)
- Tooltip auto-wire posture (consumer-composed, not automatic — mirrors `SectionNode.collapsible`)

### `viewmodel-shell-dotnet/Tests/TextMaxLinesSerializationTests.cs`

New xUnit test file — 149 lines. Byte-parallel structure with `TextWeightSerializationTests.cs` (139 lines) but for an `int?` nullable rather than a nullable enum, and using object-initializer syntax (`{ MaxLines = N }`) because the property is outside the primary ctor.

- File-header block (~40 lines) explains: (a) int? not enum (per "closed unions enforced on ONE side only"); (b) init-only property outside primary ctor rationale (binary-compat with Markdown 0.2.x); (c) direct-assertion of `Assert.DoesNotContain` as class-2 gotcha-#8 tripwire; (d) parallel to existing weight/caption/icon serialization tests
- Same `JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }` shape (no `DefaultIgnoreCondition` — proves the intrinsic `[JsonIgnore]` attribute carries the null-omission contract)
- Same `Serialize<T>` polymorphic helper

## Test Methods Added

| # | Test | What it proves |
|---|------|----------------|
| 1 | `TextNode_MaxLines_1_SerializesAsInteger` | MaxLines=1 → `"maxLines":1` in JSON |
| 2 | `TextNode_MaxLines_2_SerializesAsInteger` | MaxLines=2 → `"maxLines":2` |
| 3 | `TextNode_MaxLines_3_SerializesAsInteger` | MaxLines=3 → `"maxLines":3` |
| 4 | `TextNode_MaxLinesAbsent_OmitsField` | defaulted MaxLines → NO `"maxLines"` key (class-2 gotcha #8 direct assertion) |
| 5 | `TextNode_MaxLinesSetToNull_OmitsField` | explicit `MaxLines = null` → NO `"maxLines"` key (proves WhenWritingNull fires) |
| 6 | `TextNode_MaxLines_ComposesWithStyleAndToneAndWeight` | 4 orthogonal axes coexist in one JSON payload |
| 7 | `TextNode_MaxLines_RoundTrips` | serialize+deserialize preserves int? for each of {1,2,3} |

**Total: 7 tests, all passing.**

## Verify — Command Output

**Task 1 verify: new tests pass**
```
$ dotnet test viewmodel-shell-dotnet/Tests --filter FullyQualifiedName~TextMaxLinesSerializationTests
Passed!  - Failed:     0, Passed:     7, Skipped:     0, Total:     7, Duration: 31 ms
```

**Acceptance criterion — `public int? MaxLines` present**
```
$ grep -c "public int? MaxLines" viewmodel-shell-dotnet/ViewModels.cs
1
```

**Acceptance criterion — WhenWritingNull attribute directly above property**
```
$ grep -B1 "public int? MaxLines" viewmodel-shell-dotnet/ViewModels.cs
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public int? MaxLines { get; init; }
```

**Acceptance criterion — NOT added as positional ctor param**
```
$ grep -c "int? MaxLines = null" viewmodel-shell-dotnet/ViewModels.cs
0
```

**Acceptance criterion — framework .NET Tests project regression-free**
```
$ dotnet test viewmodel-shell-dotnet/Tests
Passed!  - Failed:     0, Passed:   465, Skipped:     0, Total:   465, Duration: 175 ms
```

**Acceptance criterion — Markdown companion still compiles**
```
$ dotnet build viewmodel-shell-dotnet/Markdown/AshleyShrok.ViewModelShell.Markdown.csproj
AshleyShrok.ViewModelShell.Markdown -> bin/Debug/net8.0/AshleyShrok.ViewModelShell.Markdown.dll
Build succeeded.
    0 Warning(s)
    0 Error(s)
```

**Acceptance criterion — companion binary-compat gate (definitive proof of binary safety)**
```
$ bash parity/check-companion-binary-compat.sh
== Pack core ==
== Pack 1 companion(s) ==
  - AshleyShrok.ViewModelShell.Markdown.csproj
== Core packed as 9.1.1 ==
== Restore + run consumer ==
companion-binary-compat: OK — 7 distinct node types constructed, all required ctors resolved.
```

The companion binary-compat gate is the definitive proof that the placement decision was correct: it packs the core (as 9.1.1 — pre-9.2.0-bump-in-a-later-plan), packs Markdown against that packed core, restores both into a throwaway consumer via a local nuget feed, and calls `MarkdownConverter.ToViewNodes(md)` — exercising the `newobj TextNode(string, Level: int?)` opcodes in Markdown's IL against the newly-shipped core. Any `MissingMethodException` at JIT-time would fail the gate. It passes, proving Markdown 0.2.x's IL still resolves against the updated `TextNode` record.

**Acceptance criterion — every demo `.NET` csproj compiles** (arity-safety for ~137 demo TextNode construction sites)
```
$ for csproj in $(find demo -name '*.csproj' -not -path '*Tests*'); do
    dotnet build "$csproj" /p:SkipFrontendBuild=true --no-restore
  done
OK: all .NET demo csprojs compile
```

All 5 demo AspNetCore csprojs compile cleanly, confirming the intent of the acceptance criterion (arity-safety for demo TextNode construction sites).

## Deviations from Plan

### Auto-fixed Issues

**None.** The plan was executed exactly as written. RED → GREEN cycle, one commit per phase.

### Deferred Issues (out-of-scope discoveries)

**1. Pre-existing environmental issue: demo `frontend/node_modules` missing `@tiptap/core`**

- **Found during:** Task 1 verify step (`for p in $(find demo -name '*.Tests.csproj'); do dotnet test "$p"; done`)
- **Symptom:** every demo `*.Tests.csproj` fails at the `BuildFrontend` MSBuild target with `[vite]: Rollup failed to resolve import "@tiptap/core" from "viewmodel-shell/src/browser.ts"`
- **Root cause:** the demo frontends consume `viewmodel-shell` via Vite alias to the source tree (per AGENTS.md: "demos here consume them via local `ProjectReference`/Vite alias to keep the dev loop tight"). Phase 28 (v8.2.0) added `@tiptap/core` + `@tiptap/starter-kit` + `turndown` as framework dependencies (browsed lazily from `browser.ts`), but the demos' `package.json` files don't declare these — they rely on Vite's node_modules resolution reaching into `viewmodel-shell/node_modules/`. This is a **pre-existing configuration gap on `main` at base commit `12160dd`** — it fails identically on the base commit without any of my changes.
- **Why NOT this plan's problem:** the plan modifies only `viewmodel-shell-dotnet/ViewModels.cs` and adds a new test file. The Vite build failure is orthogonal to the wire-type change; it's about frontend module resolution, not .NET arity or wire posture. The intent of the acceptance criterion ("proves the property placement is compile-safe for the ~137 demo `new TextNode(...)` construction sites") is arity-safety, which was proven by `dotnet build /p:SkipFrontendBuild=true` succeeding on all 5 demo csprojs.
- **Handoff to release ritual:** Plan 31-04 (release ritual, Wave 3) is responsible for the green-tree gate at publish time. The frontend build environmental issue should be resolved before then — either by adding `@tiptap/core` as a demo devDep, adjusting Vite's `optimizeDeps`, or another route the release orchestrator chooses. Logged here for handoff visibility; NOT fixed in this plan (out of scope for a wire-type change).

**2. Pre-existing xUnit2013 warning in `LookupSerializationTests.cs`**

- **Found during:** dotnet build of Tests project
- **Symptom:** `warning xUnit2013: Do not use Assert.Equal() to check for collection size. Use Assert.Single instead.`
- **File / line:** `viewmodel-shell-dotnet/Tests/LookupSerializationTests.cs(200,9)`
- **Why NOT this plan's problem:** existed before my change; not caused by any file I touched; scope boundary rules per execute-plan.md (out-of-scope discovery).

## Authentication Gates

**None** — the plan is pure .NET wire-type work, no external services, no auth.

## Threat Register Coverage

Per PLAN.md `<threat_model>`:

| Threat ID | Category | Coverage |
|-----------|----------|----------|
| T-31-02-01 | Tampering | **Accepted (documented)** — .NET int? emits unvalidated; browser CSS silently no-ops unknown classes. Documented behavior per "closed unions enforced on ONE side only" invariant. |
| T-31-02-02 | Information disclosure | **Mitigated** — Tests 4 (`TextNode_MaxLinesAbsent_OmitsField`) + 5 (`TextNode_MaxLinesSetToNull_OmitsField`) both direct-assert `Assert.DoesNotContain("\"maxLines\"", json)`. A WhenWritingNull-attribute-drop regression would fail these tests loudly at CI time (before parity's normalize scrubs the null away). |
| T-31-02-03 | Elevation of privilege | **Mitigated** — MaxLines placed as init-only property outside primary ctor; ctor arity unchanged at 7 params; `parity/check-companion-binary-compat.sh` passes (Markdown 0.2.x's packed IL resolves against packed core; no MissingMethodException). |

## Threat Flags

None. This plan adds a scalar wire field on an existing polymorphic record — no new network endpoints, no auth surface, no file access, no schema changes at trust boundaries.

## Known Stubs

None. No placeholder text, no hardcoded empty values, no unwired data sources. The property is fully implemented; the CSS class emission is Plan 31-01's territory (TS side, separate worktree).

## Self-Check: PASSED

- `viewmodel-shell-dotnet/ViewModels.cs` present with `public int? MaxLines { get; init; }` at line 1807 ✓
- `viewmodel-shell-dotnet/Tests/TextMaxLinesSerializationTests.cs` present, 149 lines ✓
- Commit `f8da329` (RED) present in git log ✓
- Commit `3cc3b67` (GREEN) present in git log ✓
- 7 new tests pass; 465/465 framework Tests pass; companion binary-compat gate green ✓

## Commits

| Hash | Message |
|------|---------|
| `f8da329` | test(31-02): add failing serialization tests for TextNode.MaxLines |
| `3cc3b67` | feat(31-02): TextNode.MaxLines axis — .NET wire + serialization tests |

## Handoff — Wave 1 to Wave 2

- **Plan 31-01 (Wave 1 TS twin, parallel worktree):** ships `maxLines?: 1 | 2 | 3` on the TS `TextNode` interface + BrowserAdapter class emission + CSS rules + vitest coverage.
- **Plan 31-03 (Wave 2, depends on 31-01 and 31-02):** adds parity fixture `parity/fixtures/textnode-maxlines.json` that diffs the two backends' JSON output for each of {unset, 1, 2, 3} + `expectBodyContains` tripwires for the CSS class emission (matching the class-3 gotcha #9 lesson from AGENTS.md). The direct-assertion tests in this plan close the class-2 gotcha-#9 defect that parity's normalize step structurally cannot see.
- **Plan 31-04 (Wave 3, release ritual):** bumps to v9.2.0 on both packages, runs the green-tree gate, publishes to npm + NuGet, tags, advances main, announces. The environmental issue with demo frontends missing `@tiptap/core` (documented above under "Deferred") should be resolved before 31-04 runs, or explicitly waived by the operator.
