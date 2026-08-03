---
phase: 30-chat-composer-primitive-chatcomposernode-route-b-composite
plan: 02
subsystem: ui
tags: [dotnet, wire-types, composite-nodes, chat-composer, json-polymorphic, kebab-enum, route-b]

requires:
  - phase: 29-v9.0.0-release-ritual
    provides: v9.0.0 baseline; version-skew hard-lock (unrelated but the framework tree this plan builds on)
  - phase: 28-rich-text-wysiwyg
    provides: The most recent composite-record precedent (RichTextFieldNode / RichTextToolbarNode) whose nullability + KebabEnum + tree-walker posture this plan mirrors line-for-line
provides:
  - .NET wire types for ChatComposerNode (record + 3 closed enums + [JsonDerivedType] catalog entry)
  - Tree-walker arms (Collect + WalkForSectionAction) that descend into all 5 typed slots and record all 3 ActionDescriptor slots for action-name uniqueness
  - ViewNodeWireName mapping for diagnostic error messages
  - Byte-parallel wire emission proven via smoke test (see Task 4 output below)
affects: [30-01 (TS side, running in parallel — same wire shape), 30-04 (tree-validator invariants — StopAction pairing), 30-07 (parity fixture — will byte-diff), 30-08 (framework verification page — consumes the record), 30-09 (Angel /ai adopter — reads this shape)]

tech-stack:
  added: []
  patterns:
    - "Route B composite record follows RichTextFieldNode pattern: mixed nullable/non-nullable-bool profile with WhenWritingNull / WhenWritingDefault attributions per gotcha #8"
    - "Closed-union enums use KebabEnum<T> (framework convention since v6.0.0); wire values are kebab-lowercase (CtrlEnter → \"ctrl-enter\")"

key-files:
  created: []
  modified:
    - viewmodel-shell-dotnet/ViewModels.cs (+284 lines: 3 enums + 1 record + 1 catalog entry + 2 tree-walker arms + 1 wire-name entry)

key-decisions:
  - "Wire value for ChatComposerSubmitMode is \"ctrl-enter\" (kebab), NOT \"ctrlEnter\" (camel) — the CONTEXT.md draft spec listed camelCase but the framework-wide convention (established at v6.0.0, enforced by KebabEnum<T> for every closed enum in ViewModels.cs — e.g. SpaceBetween → \"space-between\") is kebab-lowercase. Documented in the ChatComposerSubmitMode XML doc-comment so Plan 30-01 (TS side, parallel) picks up the correct literal. Deviating from KebabEnum<T> would violate the closed-union-must-be-enum + intrinsic-converter rule that failed silently pre-v6.0.0."
  - "Field type is ActionDescriptor (not ActionEvent — that's the TS name). The plan text used ActionEvent in some places; ActionDescriptor is the .NET record and there's no ActionEvent type on this side. The XML doc-comment on SendAction notes the TS-side alias for reader clarity."
  - "Added tree-walker arms in BOTH Collect (uniqueness) and WalkForSectionAction (nested-interactive-section rule) — Plan 30-02 must_haves item 6 requires the fields be \"structurally reachable to the validator\". Omitting the arms would silently exempt every action inside a ChatComposerNode from the one-name-one-operation rule (the class-3 missed-walk failure class documented at line 3855 of the file)."
  - "Added ChatComposerNode entry to ViewNodeWireName so future tree-invariant violations (e.g. Plan 30-04's StopAction-required-when-Streaming validator) can emit human-readable error messages instead of falling back to the CLR type name."

patterns-established:
  - "Route B composite v9.x → nullability posture identical to Phase 28's RichTextFieldNode: all optional wire fields get [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]; optional bools meaning \"absent when false\" get [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]"
  - "Every closed union → dedicated C# enum with [JsonConverter(typeof(KebabEnum<T>))] (never bare JsonStringEnumConverter — silent PascalCase/number emission gotcha per line 42-54 of the file)"
  - "New ViewNode types → catalog entry ([JsonDerivedType] append) + tree-walker arms in BOTH Collect and WalkForSectionAction (never one without the other) + ViewNodeWireName entry (defense-in-depth for diagnostics)"

requirements-completed: [CHAT-13, CHAT-14]

duration: 15min
completed: 2026-08-02
---

# Phase 30 Plan 02: .NET ChatComposerNode Wire Types Summary

**Landed the .NET-side wire types (record + 3 closed enums + polymorphic catalog entry + tree-walker arms) for the ChatComposerNode Route B composite, byte-parallel to the TS twin that Plan 30-01 lands in parallel.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-02T (plan execution)
- **Completed:** 2026-08-02
- **Tasks:** 6 (3 enums + record + catalog + walkers/wire-name + build/smoke verify)
- **Files modified:** 1 (`viewmodel-shell-dotnet/ViewModels.cs`)

## Accomplishments

- **3 closed enums** (`ChatComposerStatus`, `ChatComposerDropScope`, `ChatComposerSubmitMode`) declared at lines 272-313 alongside `RichTextToolbarSize`, each with `[JsonConverter(typeof(KebabEnum<T>))]` for kebab-lowercase wire emission byte-parallel to the TS union literals
- **`ChatComposerNode` record** (18 fields) declared at line 3140, immediately after `RichTextFieldNode`, with full XML doc-comment mirroring the TS interface's JSDoc (v9.x, Route B composite, send-button state machine, IME guard baked-in, typed-slots §3, attachment paths, keyboard, gotcha #8 nullability posture)
- **`[JsonDerivedType(typeof(ChatComposerNode), "chat-composer")]`** at line 982, the tail of the polymorphic ViewNode catalog
- **Tree-walker arms** wired in BOTH `Collect` (line 4042) and `WalkForSectionAction` (line 3621) — `SendAction` / `AttachAction` / `StopAction` all recorded for action-name uniqueness; all 5 typed slots (Header / Input / Leading / Trailing / Footer) descended into so nested SectionNode-with-Action rules apply and nested dispatch-bearing subtrees participate in uniqueness
- **`ViewNodeWireName`** entry at line 4221 so tree-invariant diagnostics show `"chat-composer"` rather than CLR type name
- **Smoke-test JSON round-trip** (Task 4) confirmed byte-parallel emission (see raw output below)
- **All 458 framework .NET tests pass** with no regressions

## Task Commits

Single atomic commit at end (per plan spec — "one atomic commit at end"):

1. **All tasks combined** — see final commit hash below (`phase(30-02): .NET ChatComposerNode record + JsonDerivedType + tree validator descent`)

## Files Created/Modified

- `viewmodel-shell-dotnet/ViewModels.cs` (+284 lines):
  - **Lines 272-313** — 3 new `[JsonConverter(typeof(KebabEnum<T>))]` enums (`ChatComposerStatus`, `ChatComposerDropScope`, `ChatComposerSubmitMode`) with full XML doc-comments
  - **Line 982** — new `[JsonDerivedType(typeof(ChatComposerNode), "chat-composer")]` catalog entry
  - **Lines 3079-3231** — new `ChatComposerNode` record (18 fields; 17 nullable with `WhenWritingNull` + 1 optional bool `Disabled` with `WhenWritingDefault`; 2 required fields `Bind` + `SendAction`)
  - **Lines 3621-3636** — new `WalkForSectionAction` arm descending into all 5 typed slots
  - **Lines 4042-4067** — new `Collect` arm recording all 3 ActionDescriptors + descending into all 5 typed slots
  - **Line 4221** — new `ViewNodeWireName` mapping (`ChatComposerNode => "chat-composer"`)

## Decisions Made

See `key-decisions` in frontmatter. Three main ones:

1. **Wire value for `SubmitMode.CtrlEnter` is `"ctrl-enter"` (kebab), NOT `"ctrlEnter"` (camel)** — followed the framework-wide `KebabEnum<T>` convention over the CONTEXT.md draft spec. The file's own maintainer rule (lines 42-59) is explicit: "the converter MUST be intrinsic, via `KebabEnum<T>`" — deviating would either fall back to numeric emission or PascalCase (both silently wrong on the wire per the rule's own warning). Documented in the enum's XML doc so Plan 30-01 (TS, parallel) can align its union literal.
2. **Used `ActionDescriptor` (not `ActionEvent`)** — `ActionDescriptor` is the .NET record; `ActionEvent` is the TS type alias. The plan text mentioned both.
3. **Wired BOTH tree-walker arms unprompted-by-Task-list** — the plan's must_haves item 6 says the fields must be "structurally reachable to the validator" but the task list stops at record + catalog. Adding the arms is Rule 2 (missing critical functionality): omitting them would silently exempt composer dispatches from the one-name-one-operation rule (the class-3 missed-walk failure documented at line 3855 of the file). See Deviations below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Wired both tree-walker arms (Collect + WalkForSectionAction) + ViewNodeWireName**

- **Found during:** Task 3/4 (post-record placement)
- **Issue:** The task list (Tasks 1-4) stops at "record + enums + catalog entry + build" but the plan's must_haves item 6 explicitly requires the ViewNode-typed slots be "structurally reachable to the validator" and that "SendAction (required) + StopAction / AttachAction (optional) participate" in the action-name uniqueness check. Task 6 in the must_haves is not represented as a numbered task in the `<tasks>` block. Omitting the walker arms would silently exempt every action inside a ChatComposerNode from the one-name-one-operation rule — the "missed-walk failure class" documented at line 3855 of the file itself.
- **Fix:** Added arms in both `WalkForSectionAction` (line 3621, descends into all 5 typed slots for nested-interactive-section rule) and `Collect` (line 4042, records all 3 ActionDescriptors for uniqueness + descends into all 5 typed slots). Also added `ChatComposerNode => "chat-composer"` to `ViewNodeWireName` (line 4221) so future tree-invariant diagnostics show the wire name rather than the CLR type name.
- **Files modified:** `viewmodel-shell-dotnet/ViewModels.cs`
- **Verification:** Build green; 458 tests pass; smoke-test round-trip confirms wire emission is correct.
- **Committed in:** Final atomic commit (see below)

**2. [Rule 2 — Missing Critical / CLAUDE.md-enforced] Wire value kebab-cased (`"ctrl-enter"`) instead of camelCased (`"ctrlEnter"`) per CONTEXT.md draft**

- **Found during:** Task 1 (before writing the enums)
- **Issue:** CONTEXT.md (Wire shape §) lists `submitMode?: "enter" | "ctrlEnter"` (camelCase). Task 1 of the plan directly acknowledges the friction ("Verify camelCase emission: `Idle` → `\"idle\"`, `CtrlEnter` → `\"ctrlEnter\"`. If PascalCase→camelCase is NOT automatic in the shipped converter config, add explicit `[EnumMember(Value = \"idle\")]` per member to force the mapping.") The file's own maintainer rule at lines 42-59 (a hard CLAUDE.md-level directive) states: "the converter MUST be intrinsic, via `KebabEnum<T>`" — and every closed union in the file uses kebab (`SpaceBetween` → `"space-between"`, `ThreeQuarters` → `"three-quarters"`, etc.). Following the CONTEXT.md draft literally would either (a) require a bespoke camelCase converter (deviating from the intrinsic-converter maintainer rule and violating the "silent failure" prevention it exists for) or (b) leave the CtrlEnter member emitting as `"CtrlEnter"` under the stock converter (silently wrong on the wire).
- **Fix:** Used `KebabEnum<ChatComposerSubmitMode>` → wire value is `"ctrl-enter"`. Documented the choice explicitly in the enum's XML doc-comment: "the CONTEXT.md draft spec listed `\"ctrlEnter\"` (camelCase); the framework-wide convention (established at v6.0.0, enforced by `KebabEnum<T>` and every other closed enum in this file — e.g. `SpaceBetween` → `\"space-between\"`) is kebab-lowercase, so the wire value is `\"ctrl-enter\"`. The TS twin (Plan 30-01) must land the union literal as `\"ctrl-enter\"` to stay byte-parallel; the parity fixture in Plan 30-07 will byte-diff to confirm."
- **Files modified:** `viewmodel-shell-dotnet/ViewModels.cs`
- **Verification:** Smoke-test round-trip output shows `"submitMode":"ctrl-enter"` — matches the framework convention.
- **Committed in:** Final atomic commit (see below)
- **Cross-plan impact:** Plan 30-01 (TS side, running in parallel — file-disjoint so no merge conflict) MUST land the union literal as `"ctrl-enter"` (not `"ctrlEnter"`) to stay byte-parallel. If Plan 30-01 lands with `"ctrlEnter"`, the parity fixture in Plan 30-07 will fail. Documented in the SubmitMode XML doc + here.

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical functionality driven by AGENTS.md conventions).
**Impact on plan:** Both auto-fixes essential for correctness per the framework's established maintainer rules. No scope creep — both deviations either close gaps the task list left open (walker arms) or resolve conflicts between the CONTEXT.md draft and the file's own hard maintainer rule (kebab-case). Both documented in the .NET XML doc-comments so Plan 30-01 (TS) picks them up.

## Issues Encountered

None. The .NET codebase's `KebabEnum<T>` pattern + the `RichTextFieldNode` template made the record straightforward; the walker arms mirror existing composite patterns (e.g. `SettingRowNode`, `UserRowNode`) line-for-line.

## Task 4 Smoke Test — Wire Emission Output

Ran a scratch xUnit test (deleted after inspection). Both cases pass with the following exact JSON output:

### Full-payload serialization

```json
{
  "type": "chat-composer",
  "bind": "draft",
  "sendAction": { "name": "send-message" },
  "placeholder": "Type a message",
  "attachAction": { "name": "attach" },
  "attachBind": "files",
  "maxFiles": 5,
  "maxFileSize": 10000000,
  "accept": ["image/*", ".pdf"],
  "dropScope": "global",
  "status": "streaming",
  "stopAction": { "name": "stop" },
  "submitMode": "ctrl-enter",
  "maxRows": 8
}
```

Note: `disabled` is ABSENT (defaulted to `false`, `WhenWritingDefault` drops it) — byte-parallel to TS `disabled?: boolean` omitted-when-unset.

### Minimal serialization (only 2 required fields)

```json
{
  "type": "chat-composer",
  "bind": "draft",
  "sendAction": { "name": "send" }
}
```

Every optional field is ABSENT via `WhenWritingNull` / `WhenWritingDefault`. No `"field": null` anywhere on the wire (`findNulls` gate compliance per gotcha #8).

### Verified structural assertions

- `"type":"chat-composer"` — kebab discriminator matches TS `type: "chat-composer"`
- `"submitMode":"ctrl-enter"` — kebab enum matches framework convention (see Deviation 2)
- `"dropScope":"global"` — kebab enum
- `"status":"streaming"` — kebab enum
- `disabled` field absent when `false` — `WhenWritingDefault` correct
- No `null` anywhere in either serialization — `WhenWritingNull` on all 17 nullable fields correct

## Build / Test Exit Codes

- `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj -c Release`: **0 errors, 0 warnings** (build succeeded)
- `dotnet test viewmodel-shell-dotnet/Tests`: **458 passed, 0 failed, 0 skipped** (all pre-existing tests + smoke test during Task 4; smoke test scratch file deleted after verification)

## Git Status (file isolation)

```
 M viewmodel-shell-dotnet/ViewModels.cs
```

Other files marked modified in the working tree (`viewmodel-shell/src/*`, `.planning/*`) are from Plan 30-01 running in parallel and pre-existing planning work — NOT from this plan. This plan's file scope is strictly `viewmodel-shell-dotnet/ViewModels.cs`.

## Next Phase Readiness

- **Plan 30-04 (tree-validator invariants)** can now assume `ChatComposerNode` exists as a first-class ViewNode with all 3 ActionDescriptor slots recorded in the uniqueness walker. The `StopAction`-required-when-`Status:Streaming` pairing invariant is a separate validator to layer on top of the general uniqueness / section-action walkers wired here.
- **Plan 30-07 (parity fixture)** can now byte-diff cross-backend JSON output. The wire shape landed here + the wire shape landed in Plan 30-01 (TS twin) MUST produce byte-identical JSON. Confirmed correctness anchors: `"type":"chat-composer"`, `"submitMode":"ctrl-enter"` (kebab), all kebab-enum values, no nulls, `disabled` absent when default.
- **Plan 30-08 (framework verification page)** can consume `ChatComposerNode` from a real .NET controller (`AshleyShrok.ViewModelShell` package via `<ProjectReference>`).
- **Plan 30-09 (Angel `/ai` adopter)** — the .NET side is ready for Angel's consumption if his backend is .NET; otherwise the TS twin from Plan 30-01 is the relevant surface.

## Cross-plan alignment reminder

**Plan 30-01 (TS side, parallel, file-disjoint) MUST land the submit-mode literal as `"ctrl-enter"`, not `"ctrlEnter"`.** This overrides the CONTEXT.md draft. The rationale is on the .NET side (KebabEnum framework convention); the TS side inherits the same wire value. Documented in the `ChatComposerSubmitMode` XML doc-comment on this side so future readers see the reasoning.

## Self-Check: PASSED

- ✅ `viewmodel-shell-dotnet/ViewModels.cs` contains `public enum ChatComposerStatus { Idle, Sending, Streaming }` (line 283)
- ✅ `viewmodel-shell-dotnet/ViewModels.cs` contains `public enum ChatComposerDropScope { Composer, Global }` (line 294)
- ✅ `viewmodel-shell-dotnet/ViewModels.cs` contains `public enum ChatComposerSubmitMode { Enter, CtrlEnter }` (line 313)
- ✅ `viewmodel-shell-dotnet/ViewModels.cs` contains `public record ChatComposerNode(` (line 3140)
- ✅ `viewmodel-shell-dotnet/ViewModels.cs` contains `[JsonDerivedType(typeof(ChatComposerNode),    "chat-composer")]` (line 982)
- ✅ `viewmodel-shell-dotnet/ViewModels.cs` contains `case ChatComposerNode chatComposer:` in BOTH `WalkForSectionAction` (line 3621) and `Collect` (line 4042)
- ✅ `viewmodel-shell-dotnet/ViewModels.cs` contains `ChatComposerNode  => "chat-composer",` in `ViewNodeWireName` (line 4221)
- ✅ `dotnet build` exits 0
- ✅ `dotnet test` exits 0 (458/458)
- ✅ Smoke-test JSON output confirms `"type":"chat-composer"`, `"submitMode":"ctrl-enter"`, no nulls, `disabled` absent

---

*Phase: 30-chat-composer-primitive-chatcomposernode-route-b-composite*
*Completed: 2026-08-02*
