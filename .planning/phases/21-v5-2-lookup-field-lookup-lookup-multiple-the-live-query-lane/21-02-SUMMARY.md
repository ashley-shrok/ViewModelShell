---
phase: 21-v5-2-lookup-field-lookup-lookup-multiple-the-live-query-lane
plan: 02
subsystem: wire-types
tags: [lookup, wire-shape, validator, dotnet, parity]
requires:
  - "21-01 (the TS wire surface this mirrors)"
provides:
  - "LookupItem record (ViewModelShell namespace)"
  - "FieldNode.Selected / Candidates / SearchBind / SearchAction / AllowCustom"
  - "Collect descends into FieldNode.SearchAction (uniqueness-checked)"
affects:
  - "21-06 (parity byte-diffs the .NET wire against the TS twin)"
  - "21-07 (FeatureProbe AspNetCore buildVm renders the lookup view-shape)"
tech-stack:
  added: []
  patterns:
    - "Append-only positional records (the UploadOn precedent)"
    - "WhenWritingNull for nullables; WhenWritingDefault for optional bools whose false means absent"
key-files:
  created:
    - viewmodel-shell-dotnet/Tests/LookupSerializationTests.cs
  modified:
    - viewmodel-shell-dotnet/ViewModels.cs
decisions:
  - "LookupItem.Type needs NO [JsonPropertyName]: the house camelCase naming policy produces `type`."
  - "The D6 `type`-absence proof is asserted on the BARE LookupItem, not a FieldNode — a FieldNode always emits the polymorphic discriminator, so the plan's FieldNode-level DoesNotContain(\"type\") was unsatisfiable."
metrics:
  duration: ~20 min
  tasks: 3
  commits: 3
  files: 2
  tests_added: 12
  completed: 2026-07-16
---

# Phase 21 Plan 02: Lookup wire surface (.NET twin) Summary

The .NET backend now mirrors the lookup wire surface byte-identically — `LookupItem` plus five
`FieldNode` members with the gotcha-#8 ignore conditions — and the .NET tree-validator descends into
`SearchAction`, so both walkers reject a duplicate search-action name.

## What landed

| Task | Commit | What |
|---|---|---|
| 1 | `e26eaf6` | `LookupItem` record; `Selected`/`Candidates`/`SearchBind`/`SearchAction`/`AllowCustom` appended to `FieldNode`; D1/D7/D8/D11/D12 carried across as C# comments; `Bind` doc names the lookup inputTypes |
| 2 | `39f03c8` | `Collect`'s `FieldNode` arm records `SearchAction` + 3 validator tests (RED confirmed first) |
| 3 | `80582a2` | `LookupSerializationTests` — 9 serialization proofs under default web JSON options |

**Fidelity notes:**

- **Append-only holds.** All five members went at the END of the positional list (the `UploadOn`
  precedent). Proven by building all 13 demo csproj — not just the framework project — since a
  mid-list insert is source-breaking for every positional call site.
- **`AllowCustom` is `bool` + `WhenWritingDefault`** ⇒ `false` is ABSENT, matching the TS optional
  bool. Every new nullable carries `WhenWritingNull`. This is the plan's whole reason to exist.
- **`Selected`/`Candidates` are always arrays** (`IReadOnlyList<LookupItem>?`) — no `T | T[]`.
- **`LookupItem.Type` needs no `[JsonPropertyName]`**: the house camelCase policy yields `type`.

## Deviations from Plan

### [Rule 1 — Plan defect] Task 3's `type`-absence behavior was unsatisfiable as written

The plan specified: *"A `LookupItem` with `Type = null` ⇒ `Assert.DoesNotContain("\"type\"", json)`"*.
**That assertion can never pass against a serialized `FieldNode`** — `FieldNode` always emits the
`[JsonPolymorphic]` discriminator `"type":"field"` (ViewModels.cs:375/381). Written literally, the test
fails; written against the FieldNode "loosely", it would be deleted by the next person as broken.

This is T-21-07 (the `Type`-vs-discriminator collision) showing up *in the test* rather than in the
wire. Resolved by splitting the claim into the two things actually worth proving:

- **`LookupItem_ValueOnly_OmitsLabelAndType`** — asserts on the **bare** `LookupItem`
  (`{"value":"u-1"}` exactly). The bare record is the only place the item's own `type` absence is
  observable, and its serializing with **no discriminator of its own** *is* the "plain sub-record, not
  a ViewNode" claim.
- **`Field_LookupItemTypeNull_DoesNotCollideWithDiscriminator`** — the FieldNode-level half: with every
  item `Type` null, `"type":` appears **exactly once** in the tree. This is a strictly stronger
  assertion than the plan's, and it is the one that would actually catch a collision.

### [Verified, not trusted] Task 3's verify greps DO fire

Per the operator's instruction, the greps were **mutation-tested** rather than assumed:

| Pattern | Good file | Guard removed |
|---|---|---|
| `DoesNotContain("\"allowCustom\"` | MATCH | NO-MATCH ✅ |
| `DoesNotContain("\"selected\"` | MATCH | NO-MATCH ✅ |
| `selected\":[` | MATCH | NO-MATCH ✅ |

All three are load-bearing (`grep -F` + single-quoted shell literals are correctly escaped as written).
The full verify command was then run verbatim and exits 0. **Notably, my first mutation attempt used
`sed` and produced two false MATCHes — the mis-escaping the operator warned about, reproduced live in
the checking tool itself.** Redone in Python with per-pattern mutants. Worth banking: the escaping trap
bites the *verifier* as readily as the verified.

### Flagged, not fixed (symmetric with 21-01, so not a drift)

The same-form uniqueness quirk 21-01 flagged applies identically on .NET: a field carrying
`Action:{name:"x"}` AND `SearchAction:{name:"x"}` **inside one form** is accepted (both pass the same
`enclosingForm`). Because both backends behave the same way, this is **not** cross-backend drift — it is
a pre-existing property of the uniqueness rule. My tests place the collision outside a form to force the
throw, matching the TS test. Out of scope to change.

## Verification

| Check | Result |
|---|---|
| `dotnet build AshleyShrok.ViewModelShell.csproj` | ✅ 0 warnings, 0 errors |
| All 13 `demo/**/*.csproj` build (append-only proof) | ✅ all succeeded |
| `dotnet test viewmodel-shell-dotnet/Tests` | ✅ **136 passed**, 0 failed (was 124 → +12) |
| All 5 `demo/**/*.Tests.csproj` | ✅ 181 passed, 0 failed (shared-validator ripple check) |
| Plan Task 1 verify (verbatim) | ✅ exit 0 |
| Plan Task 2 verify (verbatim) | ✅ exit 0 |
| Plan Task 3 verify (verbatim) | ✅ exit 0 |
| `grep -c "record LookupItem"` | ✅ 1 |
| `grep -c "field.SearchAction is"` | ✅ 1 |
| RED before GREEN (Task 2) | ✅ 2 descent-dependent tests failed pre-fix |

**Not run (out of scope, correctly):** parity, TS suite, `check:core-globals`, `check:aa-contrast`. This
plan touches only .NET types + the .NET validator and publishes nothing; the full green-tree gate is a
precondition of the phase's release closeout (21-10). **No push, no publish, no version bump, no
branch** — commits are on `main` per the operator's explicit authorization.

## Threat Flags

None. T-21-05 (walker asymmetry) mitigated — `Collect` records `SearchAction`, duplicate-rejection test
matches the TS side. T-21-06 (gotcha-#8 drift) mitigated **and asserted under default web JSON options**,
which is the only form of the assertion that proves anything about a real host. T-21-07 (`Type` vs
discriminator) mitigated by shape (plain sub-record, no `[JsonDerivedType]`), documented in a comment,
and now proven by the exactly-once assertion. T-21-08 (positional breakage) mitigated by appending and
verified by building every demo.

## Self-Check: PASSED

- `viewmodel-shell-dotnet/ViewModels.cs` — FOUND (LookupItem + 5 members + `field.SearchAction is`)
- `viewmodel-shell-dotnet/Tests/LookupSerializationTests.cs` — FOUND (12 tests)
- commit `e26eaf6` — FOUND
- commit `39f03c8` — FOUND
- commit `80582a2` — FOUND
</content>
