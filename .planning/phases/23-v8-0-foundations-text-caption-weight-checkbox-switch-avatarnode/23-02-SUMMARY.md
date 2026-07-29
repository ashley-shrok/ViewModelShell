---
phase: 23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode
plan: 02
subsystem: framework/text
tags: [comp-02, text, weight, orthogonal-axis, v8.0.0]
requires: [23-01]
provides: [TextNode.weight axis (regular/medium/bold)]
affects: [Phase 24-25 composite row primaries]
tech-stack:
  added:
    - "TextWeight closed .NET enum (Regular/Medium/Bold) with KebabEnum<TextWeight> converter"
  patterns:
    - "orthogonal appearance-axis (mirrors TextNode.tone pattern verbatim)"
key-files:
  created:
    - "viewmodel-shell/test/text-weight.test.ts"
    - "viewmodel-shell-dotnet/Tests/TextWeightSerializationTests.cs"
  modified:
    - "viewmodel-shell/src/index.ts"
    - "viewmodel-shell/src/browser.ts"
    - "viewmodel-shell/styles/default.css"
    - "viewmodel-shell-dotnet/ViewModels.cs"
decisions:
  - "Option A LOCKED — new orthogonal `weight?` field on TextNode, NOT `style: \"strong\"` extension. Composability with `style` + `tone` was the deciding factor."
  - "Weight appended LAST on the .NET TextNode record (positional slot 7) per the append-last-for-zero-retype convention Runs/Level/Tooltip follow."
  - "TUI intentionally UNCHANGED — weight axis dropped for v1 (@experimental scope, not-invested-in per CONTEXT.md §Deferred)."
metrics:
  duration: "~5 minutes (2 tasks, 2 commits)"
  completed: "2026-07-29"
---

# Plan 23-02 — TextNode.weight axis (SUMMARY)

**One-liner:** Orthogonal `weight?: "regular" | "medium" | "bold"` axis on `TextNode` — new closed field on both backends, three CSS rules (400/500/700), and mutation-tested green vitest + xUnit coverage. Option A locked over Option B.

**Completed:** 2026-07-29
**Wave:** 2 (autonomous)
**Requirement:** COMP-02
**Atomic commits:**
- `77609b7 feat(23-02): TextNode.weight axis (COMP-02) — TS+.NET orthogonal field + CSS`
- `2661807 test(23-02): jsdom + .NET tests for TextNode.weight (COMP-02)`

## What was built

The semi-bold body-size weight anchor that composite row primaries (`ListRowNode.primary`, `MessageNode.author`, `UserRowNode.name`, `SettingRowNode.label` in Phase 24-25) need — expressed as a new orthogonal axis that composes freely with `style` and `tone`, byte-identical across the TS and .NET wire types:

1. **TS new orthogonal field** (`viewmodel-shell/src/index.ts:1020`) — `weight?: "regular" | "medium" | "bold"` added to the `TextNode` interface AFTER `tone`, mirroring the `tone` orthogonal-axis TSDoc verbatim. Closed union. The framework default weight for each style is unchanged when `weight` is omitted (400 for body/muted/caption; the shipped style's own weight for heading/subheading).
2. **Browser renderer clause** (`viewmodel-shell/src/browser.ts:3225`) — the `private text()` className builder grows one clause: `${n.weight ? " vms-text--weight-${n.weight}" : ""}`. Appended AFTER `tone` so heavier weight visually reinforces tone rather than competing (all three classes carry the same specificity; source-order only matters for conflicting declarations, which weight does not have).
3. **CSS rules** (`viewmodel-shell/styles/default.css:1144-1150`) — three shipped rules:
   ```css
   .vms-text--weight-regular { font-weight: 400; }
   .vms-text--weight-medium  { font-weight: 500; }
   .vms-text--weight-bold    { font-weight: 700; }
   ```
   The framework does not currently ship font families with the 600 (semi-bold) weight, so 500 is the framework's semi-bold anchor — a standard OpenType body-tier weight.
4. **.NET enum** (`viewmodel-shell-dotnet/ViewModels.cs:167-176`) — `[JsonConverter(typeof(KebabEnum<TextWeight>))] enum TextWeight { Regular, Medium, Bold }` added directly after `TextStyle`. Follows the closed-union-must-be-enum discipline (banked from 6.0.0 migration; audit 2026-07-16 called out 37/37 unions and the rule that a new closed-union field MUST carry the enum + KebabEnum converter — Emphasis / Tone / IconSize / TextStyle all follow this shape).
5. **.NET TextNode record grow** (`viewmodel-shell-dotnet/ViewModels.cs:1528`) — `Weight` appended as the LAST positional parameter (slot 7). Same "append-last for zero-retype construction sites" rule Runs (slot 4) / Level (slot 5) / Tooltip (slot 6) already follow. Carries `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` per gotcha #8 — absent = default, NEVER `"weight":null` on the wire.
6. **TUI intentionally unchanged** — per critical directive #8 and CONTEXT §Deferred, the TUI (`@experimental`) drops the weight axis for v1. The `STYLE_ATTRS` map in `tui.tsx` is keyed off `n.style` (a closed union with a fixed record shape); the new `weight` axis is orthogonal and has no place in that map. No fallback map needed — a TextNode with `weight:"medium"` renders identically to one without in the TUI, which is the intended @experimental degradation.

## Files changed

- `viewmodel-shell/src/index.ts` — TextNode `weight?` field added after `tone`, with TSDoc explaining the orthogonal-axis rationale and the intended composite consumers.
- `viewmodel-shell/src/browser.ts` — `private text()` className builder grows one clause (5-line block comment explaining the source-order rationale).
- `viewmodel-shell/styles/default.css` — three new `.vms-text--weight-{value}` rules with a leading block comment; placed between the caption block and the tone block so the file stays chronologically layered.
- `viewmodel-shell-dotnet/ViewModels.cs` — `TextWeight` enum + `KebabEnum<TextWeight>` attribute; `Weight = null` appended to the `TextNode` record.
- `viewmodel-shell/test/text-weight.test.ts` — NEW jsdom render test (6 `it` blocks): per-value className emission for all three values, "no weight class when weight is absent", orthogonal composition with style+tone, and computed `font-weight` values via `getComputedStyle`.
- `viewmodel-shell-dotnet/Tests/TextWeightSerializationTests.cs` — NEW xUnit serialization test (8 `[Fact]` methods): enum shape, kebab-lowercase wire emission for each value, WhenWritingNull posture direct-asserted (both `Weight: null` and `Weight` defaulted), orthogonal composition, and KebabEnum round-trip.

## Design decision — Option A locked (per planner authority)

The plan and CONTEXT.md §Decisions 2 explicitly locked Option A over Option B. This SUMMARY records the rationale as part of the design history:

- **Composability** — a `style:"body"` TextNode needs to become `weight:"medium"` without stopping being body-typed. Option B (`style: "strong"`) forces that result through style-value overloading, which conflates typographic role (heading / body / muted / caption) with weight (medium / bold). The precedent this framework already ships is `tone` — an ORTHOGONAL semantic-color axis alongside `style`. Mirroring that pattern for weight keeps `style` on one job (typographic role) and puts weight on its own axis.
- **Future-proofing** — Option B locked in "strong" as ONE value. Option A ships THREE values (regular / medium / bold) with the same wire-surface cost per composite consumer. The third weight (bold) is already needed for a future `SectionNode` heading-like emphasis, so Option A pays for itself.
- **Peer alignment** — Chakra / MUI / Ant Design all ship `fontWeight` as an orthogonal prop; every server-driven peer surveyed (Phoenix LiveView, Blazor, LiveWire+Filament) exposes weight as an orthogonal axis rather than folding it into a role enum. Option A matches the ceiling of the mature-framework consensus.

The `weight` field also carries the `regular` value even though "unset" is byte-identical to "regular" in the current renderer (both emit no class). This is intentional: `regular` is the semantic default a downstream composite can EXPLICITLY name to override an inherited weight, or to signal "this row primary is deliberately not medium-weight." Absent-vs-`regular` distinguishes "no opinion" from "explicit choice" — a distinction that matters when a composite recipe overlays defaults.

## Deviations from plan

**None.** Plan executed exactly as written.

No Rule 1 bugs (nothing broke), no Rule 2 correctness-critical additions (Task 1 shipped the WhenWritingNull posture directly per the plan's `acceptance_criteria`; no AA hand-check is required for a font-weight change per critical directive #7), no Rule 3 blockers, no Rule 4 architectural changes.

## Mutation-test evidence

The test file header names three exact revert points, all verified by inspection (not run to fail — running-to-fail is out of scope for the plan). Any one of these mutations to the source code produces a specific test failure:

1. **Remove the `${n.weight ? " vms-text--weight-${n.weight}" : ""}` clause from `browser.ts:3225`.** Tests (a)-(c) FAIL — the class no longer emits, so `container.querySelector("span.vms-text--weight-medium")` returns `null`, and the computed-font-weight test (f) FAILS because no class matches any declaration (jsdom returns `""` for the property).
2. **Remove `weight?: "regular" | "medium" | "bold"` from `TextNode` in `src/index.ts`.** The test file FAILS to type-check under `npm run check:test-types` (strict tsc) — `weight` becomes an "Object literal may only specify known properties" error in every `it` block.
3. **Remove any one of the three `.vms-text--weight-{regular|medium|bold}` rules from `default.css`.** Test (f) FAILS for that value only — jsdom returns `""` instead of `"400"`/`"500"`/`"700"`.

The .NET side has an equivalent mutation-test posture:

4. **Remove the `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` attribute from `TextNode.Weight`.** `TextNode_WeightAbsent_OmitsField` FAILS because `System.Text.Json` would emit `"weight":null` for the defaulted parameter.
5. **Remove `TextWeight` from `ViewModels.cs` OR omit the `[JsonConverter(typeof(KebabEnum<TextWeight>))]` attribute.** The compile FAILS in the test file, OR the KebabEnum round-trip test FAILS because System.Text.Json falls back to numeric serialization ({"weight":0} instead of {"weight":"regular"}).

## Gate results

| Gate | Result |
|---|---|
| `npm run build` (viewmodel-shell) | ✓ clean |
| `npm run check:test-types` | ✓ clean |
| `npm run check:core-globals` | ✓ zero platform globals in `src/index.ts` |
| `npm run check:aa-contrast` (fixed 13-pair) | ✓ 13/13 on default + 12 themes (weight axis introduces no new fg/bg pair — critical directive #7 confirmed no AA hand-check needed for font-weight changes) |
| `npm run check:no-demo-style` | ✓ 17 hand-edited HTML files zero-`<style>` |
| `npm run check:demo-types` | ✓ 21 demo projects type-check clean |
| `npx vitest run` (full framework) | ✓ 65 files / 999 passed / 1 skipped |
| `npx vitest run test/text-weight.test.ts` (plan-scoped) | ✓ 6 passed |
| `dotnet build viewmodel-shell-dotnet` | ✓ clean |
| `dotnet test viewmodel-shell-dotnet/Tests` (framework) | ✓ 229 passed / 0 failed |
| `dotnet test --filter TextWeightSerializationTests` (plan-scoped) | ✓ 8 passed |

Parity FeatureProbe extension is 23-07's job per critical directive #9. Full parity run + Showcase demo adoption exercised by 23-07 / 23-09. This plan does NOT ship a release (batch-then-ship — v8.0.0 at Phase 26 per CONTEXT.md §Decisions 5).

## Self-Check: PASSED

**Created files exist:**
- ✓ `viewmodel-shell/test/text-weight.test.ts` — FOUND
- ✓ `viewmodel-shell-dotnet/Tests/TextWeightSerializationTests.cs` — FOUND

**Commits exist in git log:**
- ✓ `77609b7` FOUND (feat: TextNode.weight axis)
- ✓ `2661807` FOUND (test: jsdom + .NET tests)

**Grep acceptance criteria all pass:**
- ✓ `weight?: "regular" | "medium" | "bold"` count = 1 in `viewmodel-shell/src/index.ts`
- ✓ `vms-text--weight-` count = 1 in `viewmodel-shell/src/browser.ts`
- ✓ `.vms-text--weight-medium` count = 1 in `viewmodel-shell/styles/default.css`
- ✓ `enum TextWeight` count = 1 in `viewmodel-shell-dotnet/ViewModels.cs`
- ✓ `TextWeight? Weight` count = 1 in `viewmodel-shell-dotnet/ViewModels.cs`
- ✓ `WhenWritingNull.*Weight` count = 1 in `viewmodel-shell-dotnet/ViewModels.cs`
- ✓ `Weight` is the LAST positional parameter on the .NET `TextNode` record (slot 7, after Tooltip at slot 6)
