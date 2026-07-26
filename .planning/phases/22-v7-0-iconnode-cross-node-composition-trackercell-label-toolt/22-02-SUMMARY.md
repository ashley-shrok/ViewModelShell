# Plan 22-02 — .NET wire types + walker (SUMMARY)

**Completed:** 2026-07-26
**Wave:** 1 (autonomous)
**Requirements:** ICON-01, ICON-04, ICON-05
**Atomic commit:** `206792b feat(22-02): .NET wire types + walker for IconNode + cross-node icon prop`

## What was built

Byte-identical .NET twin of the Plan 22-01 TypeScript source-of-truth:

1. **`IconSize` enum** — Xs/Sm/Md/Lg/Xl with `KebabEnum<T>` converter → `"xs"/"sm"/"md"/"lg"/"xl"` wire.
2. **`IconName` enum** — 102 PascalCase members mirroring the TS union literals across 9 categories. All 8 Pixie/Hestia anchors present by literal name.
3. **`IconNameConverter`** — a dedicated `JsonConverter<IconName>` walking a static `Dictionary<IconName, string>`. This is a **deviation from the plan's default suggestion to reuse `KebabEnum<T>`** and is called out below in "Deviations".
4. **`IconNode` record** — positional record with required `Name` + optional `Size`/`Tone`/`Label`, each carrying `[JsonIgnore(WhenWritingNull)]`. `[JsonDerivedType(typeof(IconNode), "icon")]` registered in the polymorphism table. XML-doc pins the a11y contract.
5. **Cross-node `IconName? Icon = null`** on the 5 host records (`ButtonNode`, `LinkNode`, `SectionNode`, `BadgeNode`, `ListItemNode`), each with WhenWritingNull posture.
6. **Icon-only ButtonNode walker rule** — added to `ViewTreeValidation.ValidateActionNames`'s `case ButtonNode button:` arm in the `Collect` method. Byte-identical `InvalidOperationException` message: `"icon-only ButtonNode requires tooltip (used as aria-label)"`.
7. **`case IconNode:` leaf arms** added to both `Collect()` and `WalkForSectionAction()` walkers.
8. **Two dedicated test files** (28 new tests, all passing):
   - `IconNodeSerializationTests.cs` — 21 tests covering enum → kebab (including the number-boundary cases: `Trash2 → "trash-2"`, `CheckCircle2 → "check-circle-2"`, `Edit3 → "edit-3"`), all 8 Hestia anchors, WhenWritingNull posture on IconNode + all 5 hosts.
   - `IconOnlyButtonValidatorTests.cs` — 7 tests with FAIL-before/PASS-after by mutation, exact-message assertion for parity byte-agreement.

## Files changed

- `viewmodel-shell-dotnet/ViewModels.cs` — IconSize enum + IconName enum + IconNameConverter class + IconNode record + JsonDerivedType registration + Icon? property on 5 host records + walker arm changes.
- `viewmodel-shell-dotnet/Tests/IconNodeSerializationTests.cs` — new file, 21 test cases.
- `viewmodel-shell-dotnet/Tests/IconOnlyButtonValidatorTests.cs` — new file, 7 test cases.

## Deviations from plan — LOAD-BEARING

### 1. Dedicated `IconNameConverter` instead of reusing `KebabEnum<T>` (with rationale)

The plan (task 22-02-01) suggested reusing the existing `KebabEnum<T>` converter (which is what every other closed-union enum in the file uses — `Tone`, `TrackerState`, `Emphasis`, etc.).

**Empirical finding: `KebabEnum<T>` (backed by `JsonNamingPolicy.KebabCaseLower`) does NOT insert a hyphen at digit boundaries.** Under it:

- `Trash2` → `"trash2"` (expected `"trash-2"` per TS union)
- `Edit3` → `"edit3"` (expected `"edit-3"`)
- `CheckCircle2` → `"check-circle2"` (expected `"check-circle-2"`)
- `Share2`, `Link2`, `Loader2`, `Wand2` — same silent digit-boundary drift

A test literally caught this on the first run: `Assert.Contains("\"name\":\"trash-2\"")` failed with `"name":"trash2"`. That is exactly the class-1 defect the AGENTS.md #9 discipline warns about — both backends would compile, and parity's diff would catch it IF the fixture triggered `Trash2`. But if a fixture step only ever emitted digit-free names, the drift would ship silently.

**Fix:** replaced the `KebabEnum<IconName>` registration with a dedicated `IconNameConverter` (a `JsonConverter<IconName>` walking a static `Dictionary<IconName, string>`). Every wire value is spelled explicitly, byte-identical to the TS union literal. A static ctor integrity check throws at type-init if any enum member is missing from the map — so adding a new icon requires updating the dictionary in the same change (structurally, not from memory).

This is the plan's own preferred approach ("static dictionary walk over per-member `[EnumMember]` attributes: the dictionary is one place to grep for the full member list") — the plan flagged it as a choice; the empirical test forced the choice.

### 2. Icon-only-button predicate placed only in `Collect`, not `WalkForSectionAction`

The plan (task 22-02-04) noted "Place the predicate in whichever walker method already visits every ButtonNode in the tree — do NOT add a new top-level walker if an existing one suffices. If both `Collect` and `WalkForSectionAction` visit buttons, add the predicate in exactly ONE (prefer `Collect`)."

- Placed the predicate in `Collect`'s ButtonNode arm (which every `ValidateActionNames` invocation walks).
- Added `case IconNode:` to BOTH walkers as leaf arms per the plan.

## Gate results

| Gate | Result |
|---|---|
| `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj -c Release` | ✓ clean, 0 warnings, 0 errors |
| `dotnet test viewmodel-shell-dotnet/Tests -c Release` | ✓ 210 / 210 passed (was 182 → +28 new) |
| `dotnet test demo/Tasks/AspNetCore.Tests` | ✓ 28 / 28 passed |
| `dotnet test demo/ContactManager/AspNetCore.Tests` | ✓ 39 / 39 passed |
| `dotnet test demo/RetroBoard/AspNetCore.Tests` | ✓ 33 / 33 passed |
| `dotnet test demo/ExpenseTracker/AspNetCore.Tests` | ✓ 30 / 30 passed |
| `dotnet test demo/HelpDesk/AspNetCore.Tests` | ✓ 61 / 61 passed |

## Acceptance criteria — all met

- `grep -c "public enum IconName" viewmodel-shell-dotnet/ViewModels.cs` → 1 ✓
- All 8 Pixie anchors present as enum members ✓
- `IconNameConverter` class exists ✓
- Wire mapping: Sparkles→"sparkles", ShieldCheck→"shield-check", Trash2→"trash-2" (all three verified via passing tests) ✓
- `grep -c "public record IconNode" viewmodel-shell-dotnet/ViewModels.cs` → 1 ✓
- `grep -c "JsonDerivedType(typeof(IconNode), \"icon\")" viewmodel-shell-dotnet/ViewModels.cs` → 1 ✓
- IconNode carries required `Name: IconName` (not string) ✓
- Every optional on IconNode has `[property: JsonIgnore(WhenWritingNull)]` ✓
- IconNode XML-doc contains `role="img"` and `aria-hidden` ✓
- `grep -c "IconName? Icon = null" viewmodel-shell-dotnet/ViewModels.cs` → 5 ✓
- `grep -c "icon-only ButtonNode requires tooltip" viewmodel-shell-dotnet/ViewModels.cs` → 1 ✓
- Both walker methods have `case IconNode` arms ✓
- Icon-only-button predicate fires from within the ButtonNode walker arm ✓
- Framework build + framework Tests + every demo Tests all green ✓

## Byte-parity with TS twin (Plan 22-01) verified

The number-boundary case (`Trash2 → "trash-2"`) is now proven byte-identical between backends:
- TS twin has `"trash-2"` in the union literal (from Plan 22-01's `IconName` union).
- .NET twin now emits `"trash-2"` on the wire via `IconNameConverter`.
- Same for `edit-3`, `check-circle-2`, `share-2`, `link-2`, `loader-2`, `wand-2`.

Plan 22-07's parity FeatureProbe will exercise at least one of these names to keep the coverage tripwire honest.

## Next dependency

Plan 22-03 (TrackerCell.label → tooltip rename) — pure wire-type rename on both backends. The renderer swap to the TOOL-01 tooltip infrastructure lives in Plan 22-05.
