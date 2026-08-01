---
phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
plan: 02
subsystem: wire-types
tags: [viewmodel-shell, composite-nodes, wire-types, dotnet, csharp, rich-text, tiptap, route-b, phase-28]

# Dependency graph
requires:
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 01
    provides: The TS wire contract (RichTextFieldNode + RichTextToolbarNode interfaces + RichTextTool closed union in `viewmodel-shell/src/index.ts`; validator arms in `server.ts`) that this plan mirrors byte-for-byte on the .NET twin. File-disjoint from 28-01 — the two ran in Wave 1 in parallel.
  - phase: 24-v8-0-composite-nodes-layer-route-b-primary-composites-and-1-wir
    provides: MessageNode as the composite record TSDoc golden template mirrored by RichTextToolbarNode; AvatarNode as the leaf-input record shape + the `case AvatarNode:` walker leaf-arm template mirrored by BOTH new nodes.
  - phase: 22-icons-primitive-icon-set-inline-bundled-svg-payload-registry-fram
    provides: IconNameConverter (`viewmodel-shell-dotnet/ViewModels.cs:276-376`) as the explicit-dictionary JsonConverter template that RichTextToolConverter mirrors verbatim (byte-boundary-aware wire strings that KebabEnum<T> cannot produce).

provides:
  - Two new .NET records in `viewmodel-shell-dotnet/ViewModels.cs`: `RichTextFieldNode` (leaf-input primitive, D-01) at line 2996 and `RichTextToolbarNode` (Route B composite, D-02) at line 2923. Both carry per-property `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` on every nullable and `WhenWritingDefault` on every optional bool per gotcha #8.
  - One new closed union: `RichTextTool` (11 values matching D-08 Slack/GitHub floor) at line 356 with a dedicated `RichTextToolConverter` (line 288) — NOT `KebabEnum<T>` because Heading1/2/3, BulletList, OrderedList, InlineCode, CodeBlock all need digit-boundary hyphens the KebabCaseLower policy silently drops (same footgun IconNameConverter documents).
  - One additional closed union: `RichTextToolbarSize` (Compact, Expanded) at line 270 with `KebabEnum<T>` (safe — single-token members).
  - Two new `[JsonDerivedType]` discriminators appended to the ViewNode polymorphism block at lines 937-938: `"rich-text-field"` and `"rich-text-toolbar"`.
  - Two new leaf-arm walker cases (`case RichTextFieldNode: break;` + `case RichTextToolbarNode: break;`) added to EACH of the two walkers in `ViewTreeValidation`: `WalkForSectionAction` at lines 3376 + 3385 and `Collect` at lines 3778 + 3788. Both mirror the `case AvatarNode:` no-op leaf-arm pattern immediately preceding — exhaustive-switch defense-in-depth per Analog D.
  - `viewmodel-shell-dotnet/Tests/RichTextSerializationTests.cs` (356 lines) — 9 xUnit facts covering minimum-shape null-omission, full-shape field emission + narrow-typed Toolbar behavior, WhenWritingDefault gate on Required + Disabled (two facts), all 11 RichTextTool wire values including digit-boundary anti-drift, RichTextToolbarSize kebab-case, polymorphic discriminator emission through ViewNode base (both nodes), and a findNulls scan across >100 shape permutations.

affects: [28-03 (renderer will dispatch on the concrete .NET types the parity fixture emits), 28-07 (parity fixture — FeatureProbe .NET twin can now safely emit RichTextFieldNode + RichTextToolbarNode with expectBodyContains tripwires), 28-08 (agent-skill — .NET AgentSkill.md byte-identical copy of the updated TS agent-skill.md), 28-11 (release ritual — the v8.2.0 aligned NuGet bump now has all the .NET wire types to publish)]

# Tech tracking
tech-stack:
  added: []  # No new deps — pure .NET record + enum + converter additions inside the shipped `ViewModels.cs`.
  patterns:
    - "Explicit-dictionary JsonConverter for closed unions with digit-boundary members (Heading1 → 'heading-1', NOT KebabEnum<T>'s silent 'heading1' drop): mirrors IconNameConverter's shape verbatim, including the static integrity check that every enum value has a wire-string mapping (fails at JsonSerializer construction, not silently at wire time)."
    - "Narrow slot typing (RichTextFieldNode.Toolbar: RichTextToolbarNode? NOT ViewNode?) when polymorphism doesn't matter — sidesteps the polymorphic-discriminator emission-per-slot rule (MessageNode.Actions: IReadOnlyList<ViewNode>? uses the OPPOSITE rule where discriminator IS wanted). Analog C's decision rule: narrow when a random ViewNode as this slot is meaningless."
    - "Walker leaf-arm exhaustive-switch discipline: both new nodes get `case ... break;` no-op arms in BOTH walkers per Analog D, so a future refactor that adds a dispatch-bearing slot to either node fails the C# exhaustiveness check (or is caught by the walker's arm being wrong)."

key-files:
  created:
    - "viewmodel-shell-dotnet/Tests/RichTextSerializationTests.cs (+356 lines, 9 xUnit facts)"
    - ".planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-02-SUMMARY.md (this file)"
  modified:
    - "viewmodel-shell-dotnet/ViewModels.cs (+291 lines total across both tasks; insertion sites documented below)"

key-decisions:
  - "RECORD ORDER — placed RichTextToolbarNode FIRST (line 2923) and RichTextFieldNode SECOND (line 2996). Rationale: RichTextFieldNode.Toolbar's static default parameter `RichTextToolbarNode? Toolbar = null` requires RichTextToolbarNode to be already declared. C# records are order-sensitive at declaration when a primary-ctor default parameter references another type by name (the compiler resolves types lexically inside the same file). Reversed order would compile via forward-reference resolution in .NET, but placing the referenced type first is idiomatic + more readable. Neither plan hint nor Analog C imposed an order; this is a mechanical readability choice."
  - "DEDICATED CONVERTER FOR RichTextTool (not KebabEnum<RichTextTool>) — locked by the file's own header commentary at lines 42-59 and mirroring IconName's precedent at lines 397-403. KebabCaseLower does not split letter-digit boundaries, so `RichTextTool.Heading1` would silently emit as `\"heading1\"` (not `\"heading-1\"`), drifting from the TS union `\"heading-1\" | \"heading-2\" | \"heading-3\"` — the exact class-2-style silent-wire-drift the file exists to prevent. RichTextToolConverter follows IconNameConverter's shape verbatim: explicit `_toWire` dictionary, `_fromWire` inverse-derived, static-ctor integrity check that every enum member is mapped."
  - "RichTextToolbarSize KEEPS KebabEnum<T> (safe) — both members (Compact, Expanded) are single-token PascalCase with no digit boundaries, so KebabCaseLower emits `\"compact\"` / `\"expanded\"` correctly. Splitting into a dedicated converter here would be overkill without a hazard. Rule: use dedicated converter iff enum has digit-boundary OR multi-word-with-embedded-numeric members; otherwise KebabEnum<T> is fine."
  - "NARROW TYPING RichTextFieldNode.Toolbar : RichTextToolbarNode? (NOT ViewNode?) — Analog C's explicit HARD CONSTRAINT (\"a consumer would never legitimately pass a random ViewNode as a toolbar\"). Consequence: the nested toolbar does NOT carry the polymorphic `\"type\":\"rich-text-toolbar\"` discriminator when nested inside RichTextFieldNode (STJ emits only the declared-type's own properties). This is the intended trade-off — the discriminator emits only when the toolbar is a TOP-LEVEL ViewNode (e.g. an app rendering a bare toolbar). Test 2 (`FullShape_EmitsAllSetFields_OmitsUnset`) initially asserted the nested discriminator, was corrected once the trade-off was surfaced; test 6/8 (`_UsesPolymorphicDiscriminator_ThroughViewNode`) covers the top-level case explicitly for both nodes."
  - "TEST COUNT — plan spec said 7 tests; delivered 9. Test #3 in the plan (WhenWritingDefault gate) split into two `[Fact]`s (one for Required, one for Disabled) for clearer failure diagnostics. Test #6 (polymorphic discriminator through ViewNode) added a second variant for RichTextToolbarNode (symmetric with the RichTextFieldNode variant) because both are new discriminators and both deserve independent coverage. All 9 pass; the full 451-test framework suite still passes."

patterns-established:
  - "For any future closed-union enum whose members carry digit-boundary or embedded-numeric tokens (e.g. hypothetical Heading4, ChapterN, VersionN.M), the .NET-side wire type MUST use an explicit-dictionary JsonConverter (mirroring RichTextToolConverter + IconNameConverter) — NOT KebabEnum<T>. The failure mode of using KebabEnum<T> is silent per-member wire drift that only a serialization test catches (parity/normalize.ts cannot see it because both backends might agree wrong, per class-1 defect). RichTextToolConverter is the third instance of this pattern; the pattern is stable — reach for it, don't invent."
  - "For a nested composite slot where polymorphism does NOT matter (only one concrete type is ever legitimate), narrow the slot's type to that concrete record and accept the loss of the polymorphic discriminator ON THE NESTED SLOT. When polymorphism DOES matter (the slot can be any ViewNode), type the slot as `ViewNode?` / `IReadOnlyList<ViewNode>?` and rely on the discriminator emitting through the declared-type-drops-DeclaredType rule. Reference: RichTextFieldNode.Toolbar (narrow) vs MessageNode.Actions (wide). Both are correct; the choice is per-slot semantics."

requirements-completed: [RICH-01, RICH-04]

# Metrics
duration: ~35 min
completed: 2026-07-31
---

# Phase 28 Plan 02: Rich text WYSIWYG .NET twin wire types Summary

**Added `RichTextFieldNode` + `RichTextToolbarNode` .NET records + `RichTextTool` closed enum (with dedicated digit-boundary-aware `RichTextToolConverter`) + `RichTextToolbarSize` enum + 2 `[JsonDerivedType]` discriminators + 2 leaf-arm walker cases in EACH of the two .NET tree walkers in `viewmodel-shell-dotnet/ViewModels.cs`, plus 9 xUnit facts in `RichTextSerializationTests.cs` that prove byte-alignment with the TS twin (Plan 28-01) — establishing the v8.2.0 .NET wire contract that Plans 28-03 through 28-11 build against.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2 (both `type="auto"`, both `autonomous: true`)
- **Files modified:** 1 (viewmodel-shell-dotnet/ViewModels.cs — +291 lines total across the 2 commits)
- **Files created:** 2 (RichTextSerializationTests.cs + this SUMMARY.md)
- **Tests added:** 9 xUnit facts, all passing
- **Full framework test suite:** 451 tests, 0 failures (baseline was 442, +9 from this plan)

## Accomplishments

### Task 1 — Wire types + 2 enums + 1 converter + 2 discriminators in `ViewModels.cs` (commit `bb81fe8`)

Four insertions to `viewmodel-shell-dotnet/ViewModels.cs`:

1. **Two `[JsonDerivedType]` discriminators at lines 937-938** (appended to the ViewNode polymorphism block at the end of the composite cluster, immediately after the ChipNode + ChipListNode entries):
   - `[JsonDerivedType(typeof(RichTextFieldNode),   "rich-text-field")]`
   - `[JsonDerivedType(typeof(RichTextToolbarNode), "rich-text-toolbar")]`

2. **Three declarations at lines 262-364** (adjacent to the other closed-union enums, right after `MessageRole` at line 259):
   - `RichTextToolbarSize` enum (Compact, Expanded) at line 270 — `[JsonConverter(typeof(KebabEnum<RichTextToolbarSize>))]` (safe: single-token members, no digit-boundary hazard).
   - `RichTextToolConverter` class at line 288 — explicit `_toWire` dictionary + `_fromWire` inverse + static integrity-check ctor (mirrors IconNameConverter shape at lines 276-376). Non-KebabEnum because RichTextTool has digit-boundary members (Heading1/2/3) and multi-word members that need embedded hyphens (BulletList → "bullet-list", InlineCode → "inline-code", CodeBlock → "code-block") — KebabCaseLower's letter-only splitting rule would silently drop these.
   - `RichTextTool` enum at line 356 — 11-value D-08 Slack/GitHub floor with `[JsonConverter(typeof(RichTextToolConverter))]`. Members: Bold, Italic, Link, BulletList, OrderedList, Heading1, Heading2, Heading3, InlineCode, CodeBlock, Blockquote.

3. **Two records at lines 2923-3034**, placed adjacent to the other Route B composite records (right after ChipListNode at line 2775, before the `ViewTreeValidation` static class):
   - **`RichTextToolbarNode`** at line 2923 (placed FIRST because RichTextFieldNode's default parameter references it):
     - REQUIRED: `IReadOnlyList<RichTextTool> Tools` (closed enum, NOT `IReadOnlyList<string>` per closed-union-must-be-enum).
     - OPTIONAL: `RichTextToolbarSize? Size`, `Tone? Tone`, `string? State` — each `[JsonIgnore(WhenWritingNull)]`.
     - TSDoc: v8.2.0 (RICH-02), D-03 tasting-before-ship gate, typed-slots §3 pattern, D-02 anticipated axes (visibleTools, headings-dropdown, position, compact/expanded, overflow-to-kebab), leaf-posture rationale (Tools[] are client-side enum tokens, not dispatches).
   - **`RichTextFieldNode`** at line 2996:
     - REQUIRED: `string Name`, `string Bind` (bindless rich text field is meaningless).
     - OPTIONAL nullables: `string? Label`, `string? Placeholder`, `RichTextToolbarNode? Toolbar` (narrow-typed per Analog C — NOT `ViewNode?`), `string? State` — each `[JsonIgnore(WhenWritingNull)]`.
     - OPTIONAL bools: `bool Required = false`, `bool Disabled = false` — each `[JsonIgnore(WhenWritingDefault)]` per gotcha #8.
     - TSDoc: v8.2.0 (RICH-01), D-01 dedicated-node rationale, D-06 markdown-string wire, D-04 lazy-bundling, D-Q4 sanitization, D-08 floor, deferred customization surface enumeration (allowedMarks/allowedNodes, mentionsProvider, plainTextValueBind, heightMin/heightMax, sanitizeConfig, imageUpload, comment-only mode).

Build verification: `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` → exit 0, 0 warnings, 0 errors.

### Task 2 — Walker arms + 9 serialization tests (commit `6972cc1`)

**(a) Walker arms in `ViewModels.cs`** — two `case ... break;` no-op arms added to EACH of the two walkers in `ViewTreeValidation`, immediately after the existing `case AvatarNode:` no-op arm:

- **`WalkForSectionAction`** (SectionNode-specific rules walker):
  - `case RichTextFieldNode:` at line 3376
  - `case RichTextToolbarNode:` at line 3385
- **`Collect`** (action-name uniqueness walker):
  - `case RichTextFieldNode:` at line 3778
  - `case RichTextToolbarNode:` at line 3788

Per Analog D, both new nodes are LEAVES for both walkers:
- **RichTextFieldNode** has no action-bearing descendants; its `Toolbar` slot's inner `Tools[]` are `RichTextTool` enum tokens naming built-in TipTap chain commands resolved client-side, never framework-side ActionDescriptor dispatches that could collide via `ValidateActionNames`.
- **RichTextToolbarNode**'s `Tools[]` are the same enum tokens — client-side only.

Both arms exist for defense-in-depth (exhaustive-switch discipline): a future refactor that adds a dispatch-bearing slot to either node fails the C# switch's implicit exhaustiveness check first (each walker's `switch` has NO `default:` for the leaf class, so a missing arm silently walks through — the presence of both arms documents the leaf posture explicitly).

**(b) `viewmodel-shell-dotnet/Tests/RichTextSerializationTests.cs`** — 9 xUnit `[Fact]` tests (356 lines total) mirroring `MessageNodeSerializationTests.cs`'s shape:

| # | Test | Proves |
|---|------|--------|
| 1 | `RichTextFieldNode_MinimumShape_EmitsExactly_TypeNameBind` | Bare `new RichTextFieldNode(Name, Bind)` emits EXACTLY `{type, name, bind}`. Zero null keys. No `required`/`disabled` (WhenWritingDefault). Uses `JsonDocument` for order-independent property enumeration. |
| 2 | `RichTextFieldNode_FullShape_EmitsAllSetFields_OmitsUnset` | Every field set emits every set field; nested Toolbar's own fields land; NO nested `type` discriminator (Toolbar is narrow-typed per Analog C — documented in test comment); `Disabled: false` explicitly set STILL absent (WhenWritingDefault gate); no literal null values. |
| 3 | `RichTextFieldNode_Required_False_IsAbsent` | `Required: false` → key absent; `Required: true` → `"required":true`. |
| 4 | `RichTextFieldNode_Disabled_False_IsAbsent` | `Disabled: false` → key absent; `Disabled: true` → `"disabled":true`. |
| 5 | `RichTextToolbarNode_Tools_EmitAsKebabCase` | All 11 RichTextTool wire literals present (`"bold"`, `"bullet-list"`, `"heading-1"`, `"inline-code"`, `"code-block"`, `"blockquote"`, `"link"`, `"ordered-list"`, `"heading-2"`, `"heading-3"`, `"italic"`); explicit anti-drift assertions that the without-hyphen forms (`"heading1"`, `"heading2"`, `"heading3"`, `"inlinecode"`, `"codeblock"`, `"bulletlist"`, `"orderedlist"`) are ABSENT — proves RichTextToolConverter is wired, not KebabEnum. |
| 6 | `RichTextToolbarNode_Size_EmitAsKebabCase` | `Size: Compact` → `"size":"compact"`; `Size: Expanded` → `"size":"expanded"`. |
| 7 | `RichTextFieldNode_UsesPolymorphicDiscriminator_ThroughViewNode` | `JsonSerializer.Serialize<ViewNode>(node)` on `RichTextFieldNode` includes `"type":"rich-text-field"`. Gotcha #1 protection. |
| 8 | `RichTextToolbarNode_UsesPolymorphicDiscriminator_ThroughViewNode` | Same for `RichTextToolbarNode` → `"type":"rich-text-toolbar"`. |
| 9 | `RichTextFieldNode_FindNulls_ScanAllShapes` | Enumerates >100 shape permutations (3 toolbar shapes × 2 labels × 2 placeholders × 2 requireds × 2 disableds × 2 states + 5 toolbar-only shapes), aggregates all output strings, asserts ZERO literal null substrings (`":null` and `": null`). The direct in-code invariant `parity/normalize.ts` cannot make. Sanity-check assertion (`shapeCount > 100`) guards against a future refactor that elides the loops. |

Test-run output: `Failed: 0, Passed: 9, Skipped: 0, Total: 9`. Full framework suite: `Failed: 0, Passed: 451`.

## Task Commits

| # | Task                                                                                             | Commit    | Files                                                                                                          |
|---|--------------------------------------------------------------------------------------------------|-----------|----------------------------------------------------------------------------------------------------------------|
| 1 | Add RichTextFieldNode + RichTextToolbarNode records + 2 enums + RichTextToolConverter + 2 discriminators | `bb81fe8` | viewmodel-shell-dotnet/ViewModels.cs (+258 lines)                                                              |
| 2 | Add walker leaf-arm cases in both walkers + RichTextSerializationTests.cs                        | `6972cc1` | viewmodel-shell-dotnet/ViewModels.cs (+33 lines walker arms), viewmodel-shell-dotnet/Tests/RichTextSerializationTests.cs (+356 lines) |

## Insertion sites (post-edit line numbers)

`viewmodel-shell-dotnet/ViewModels.cs`:

| Insertion                                                              | Line |
|------------------------------------------------------------------------|------|
| `[JsonDerivedType(typeof(RichTextFieldNode),   "rich-text-field")]`    | 937  |
| `[JsonDerivedType(typeof(RichTextToolbarNode), "rich-text-toolbar")]`  | 938  |
| `public enum RichTextToolbarSize { Compact, Expanded }`                | 270  |
| `public sealed class RichTextToolConverter : JsonConverter<RichTextTool>` | 288  |
| `public enum RichTextTool { ... }`                                     | 356  |
| `public record RichTextToolbarNode(...)`                               | 2923 |
| `public record RichTextFieldNode(...)`                                 | 2996 |
| `case RichTextFieldNode:` in `WalkForSectionAction`                    | 3376 |
| `case RichTextToolbarNode:` in `WalkForSectionAction`                  | 3385 |
| `case RichTextFieldNode:` in `Collect`                                 | 3778 |
| `case RichTextToolbarNode:` in `Collect`                               | 3788 |

`viewmodel-shell-dotnet/Tests/RichTextSerializationTests.cs`: 9 `[Fact]` methods, 356 lines total.

## Verification

All plan-listed automated verifications green:

| Check                                                                                                     | Result |
|-----------------------------------------------------------------------------------------------------------|--------|
| `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj`                                   | exit 0, 0 warnings, 0 errors |
| `grep -c 'public record RichTextFieldNode' viewmodel-shell-dotnet/ViewModels.cs`                          | 1 (required: 1) |
| `grep -c 'public record RichTextToolbarNode' viewmodel-shell-dotnet/ViewModels.cs`                        | 1 (required: 1) |
| `grep -c 'public enum RichTextTool$' viewmodel-shell-dotnet/ViewModels.cs`                                | 1 (required: 1) |
| `grep -c 'public enum RichTextToolbarSize' viewmodel-shell-dotnet/ViewModels.cs`                          | 1 (required: 1) |
| `grep -c 'JsonDerivedType(typeof(RichTextFieldNode)' viewmodel-shell-dotnet/ViewModels.cs`                | 1 (required: 1) |
| `grep -c 'JsonDerivedType(typeof(RichTextToolbarNode)' viewmodel-shell-dotnet/ViewModels.cs`              | 1 (required: 1) |
| `grep -c 'case RichTextFieldNode:' viewmodel-shell-dotnet/ViewModels.cs`                                  | 2 (required: 2, matches `case AvatarNode:` baseline) |
| `grep -c 'case RichTextToolbarNode:' viewmodel-shell-dotnet/ViewModels.cs`                                | 2 (required: 2, matches baseline) |
| `grep -c 'case AvatarNode:' viewmodel-shell-dotnet/ViewModels.cs` (baseline cross-check)                  | 2 |
| Every `? Label`/`? Placeholder`/`? Toolbar`/`? Size`/`? Tone`/`? State` on the new records preceded by `WhenWritingNull` | Verified by grep + code review |
| Every `bool Required = false` / `bool Disabled = false` on `RichTextFieldNode` preceded by `WhenWritingDefault`         | Verified |
| `dotnet test viewmodel-shell-dotnet/Tests --filter FullyQualifiedName~RichTextSerializationTests`         | 9 passed, 0 failed |
| `dotnet test viewmodel-shell-dotnet/Tests` (full suite)                                                    | 451 passed, 0 failed |

## Deviations from Plan

**1. [Placement discretion] Records placed at end of composite cluster, not adjacent to MessageNode**

- **Found during:** Task 1 planning.
- **Issue:** Plan hint said "adjacent to the other Route B composite records (near MessageNode / UserRowNode / SettingRowNode)". Literal reading would insert between existing composites. RichTextToolbarNode + RichTextFieldNode instead landed AFTER ChipListNode (the last existing composite) and before the `ViewTreeValidation` static class — a natural append to the composite cluster, keeping the existing composite ordering (Message* → Alert → UserRow → DetailRow* → Timeline* → SettingRow* → Chip*) undisturbed.
- **Fix:** Appended at line 2923+. All acceptance-criteria greps pass; the placement is purely cosmetic.
- **Files modified:** none additional (this is where the initial Edit landed).

**2. [Placement discretion] RichTextToolbarNode declared BEFORE RichTextFieldNode**

- **Found during:** Task 1 build attempt.
- **Issue:** RichTextFieldNode's primary-ctor default parameter `RichTextToolbarNode? Toolbar = null` references the toolbar type by name. C# records are order-sensitive in a single file when a default parameter references another type — the natural order (field first, then toolbar) requires the compiler to forward-resolve. .NET does support this, but placing the referenced type first is more idiomatic + cleaner to read.
- **Fix:** RichTextToolbarNode at line 2923; RichTextFieldNode at line 2996.
- **Files modified:** none additional.

**3. [Rule 1 — Bug caught by test] Test 2 asserted the nested `Toolbar` carried a polymorphic `"type":"rich-text-toolbar"` discriminator; corrected to reflect the narrow-typing decision**

- **Found during:** Task 2 first `dotnet test` run — 8/9 passed, 1 failed with `Assert.Contains: "type":"rich-text-toolbar" not found`.
- **Issue:** The initial write of `RichTextFieldNode_FullShape_EmitsAllSetFields_OmitsUnset` asserted `Assert.Contains("\"type\":\"rich-text-toolbar\"", json)`. That assumption was wrong: because `RichTextFieldNode.Toolbar` is typed as the CONCRETE `RichTextToolbarNode?` on the record (NOT `ViewNode?`) per Analog C's HARD CONSTRAINT ("Do NOT type Toolbar as ViewNode?"), System.Text.Json serializes the nested value AS its declared type — which does NOT include the `[JsonDerivedType]` discriminator. The discriminator only fires when a value is serialized AS the ViewNode base.
- **Fix:** Removed the `Assert.Contains("\"type\":\"rich-text-toolbar\"", ...)` line from test 2 and added a clarifying comment documenting the trade-off ("the nested toolbar does NOT carry the polymorphic type discriminator here — see `RichTextToolbarNode_UsesPolymorphicDiscriminator_ThroughViewNode` for the top-level case"). Tests 7 + 8 cover the top-level polymorphic discriminator case explicitly for both nodes.
- **Files modified:** `viewmodel-shell-dotnet/Tests/RichTextSerializationTests.cs` (in the same commit as the initial write — no separate commit hash).
- **Rule applied:** Rule 1 (bug fix — test assertion was incorrect for the design decision).

**4. [Interpretive] Test count is 9, plan spec said 7**

- **Found during:** Task 2 test-file drafting.
- **Issue:** Plan test #3 was described as one `[Fact]` covering both Required and Disabled WhenWritingDefault gating. Splitting into two separate `[Fact]`s (one per field) gives clearer failure diagnostics — if `Required` behavior regresses but `Disabled` is fine, only the Required test fails. Similarly, plan test #6 was one polymorphic-discriminator test for `RichTextFieldNode`; adding a second symmetric variant for `RichTextToolbarNode` gives equal coverage to both new discriminators (both are load-bearing gotcha #1 protection).
- **Fix:** 9 `[Fact]`s delivered instead of 7. Semantically equivalent coverage + finer-grained failure signal.
- **Files modified:** none additional (this is the intended test-file content).

No other deviations. No Rule 4 architectural-decision escalations. No authentication gates. No pre-existing test failures encountered (baseline 442 → 451 with the 9 additions, all pass).

## Self-Check

**1. Created files exist:**

- `viewmodel-shell-dotnet/Tests/RichTextSerializationTests.cs` → FOUND (356 lines).
- `.planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-02-SUMMARY.md` → FOUND (this file).

**2. Modified files exist and contain the expected additions:**

- `viewmodel-shell-dotnet/ViewModels.cs` → FOUND. Contains all 11 grep-targets: 2 records (RichTextFieldNode + RichTextToolbarNode), 2 enums (RichTextTool + RichTextToolbarSize), 1 converter (RichTextToolConverter), 2 discriminators (`"rich-text-field"` + `"rich-text-toolbar"`), 4 walker arms (2 in each walker).

**3. Commits exist:**

- `bb81fe8` → FOUND (`feat(28-02): add RichTextFieldNode + RichTextToolbarNode .NET wire types`).
- `6972cc1` → FOUND (`test(28-02): add walker arms + RichTextSerializationTests for RichText nodes`).

**4. Build + tests green:**

- `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` → exit 0, 0 warnings, 0 errors.
- `dotnet test viewmodel-shell-dotnet/Tests` → 451 passed, 0 failed (baseline 442 + 9 new).

## Self-Check: PASSED
