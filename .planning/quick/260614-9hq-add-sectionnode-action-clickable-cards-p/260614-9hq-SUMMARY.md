---
phase: 260614-9hq-add-sectionnode-action-clickable-cards
plan: 01
requirements: [ISSUE-20]
completed: 2026-06-14
---

# 260614-9hq — SectionNode.action clickable-card primitive

Closes the unfixed half of [#19](https://github.com/ashley-shrok/ViewModelShell/issues/19) via [#20](https://github.com/ashley-shrok/ViewModelShell/issues/20). Added a click-anywhere clickable-card primitive at the section level — mirrors `TableRow.action` (1.1.0) one level up the tree. Lockstep MINOR bump: npm 1.3.0 → **1.4.0**, NuGet 1.2.0 → **1.3.0**.

## Per-task summary

### Task 1 — TS wire field + renderer + CSS

- `SectionNode.action?: ActionEvent` declared in `viewmodel-shell/src/index.ts` with TSDoc that names the click/keyboard/ARIA contract, the stopPropagation containment rule, and the two tree-validation rejections.
- BrowserAdapter's section renderer (`viewmodel-shell/src/browser.ts`) now wires:
  - `vms-section--clickable` class when `n.action` is set
  - `tabIndex = 0`, `role="button"`
  - `aria-label` derived from `heading` if non-empty, else from `el.textContent` with whitespace runs collapsed to a single space (capped at 200 chars), else literal `"Card"`
  - `click` handler that dispatches `{name}`
  - `keydown` handler dispatching on Enter and Space (Space additionally `preventDefault`s)
  - `stopPropagation` containment via `el.querySelectorAll(".vms-button, .vms-checkbox__input, .vms-checkbox, .vms-table__link, a[href]")` after `kids()` runs
- `default.css` gains a `.vms-section--clickable` block: cursor + accent-dim ring on hover (a background swap would be invisible — cards already paint `--vms-surface`) + 2px accent outline on `:focus-visible` with positive `outline-offset` (section is a box; ring outside the edge).
- The collapsible branch is unchanged — combo rejection happens at validation time, not in the renderer.
- **Commit:** `10990ab feat(260614-9hq): add SectionNode.action click-anywhere primitive (TS + CSS)`

### Task 2 — .NET wire field + ValidateSectionAction

- `SectionNode` record (`viewmodel-shell-dotnet/ViewModels.cs`) gains a trailing positional param `[JsonIgnore(WhenWritingNull)] ActionDescriptor? Action = null` after `Id`. Default null preserves every existing positional call site (verified by building the HelpDesk demo).
- New `ViewTreeValidation.ValidateSectionAction(ViewNode root)` walks the tree once with a threaded `outerClickable: SectionNode?` parameter and throws `InvalidOperationException` (mapped by the framework's filter to `invalid_tree`) for:
  - (a) `Action != null && Collapsible == true` on the same section — "both Action and Collapsible: true"
  - (b) A `SectionNode.Action != null` with an ancestor `SectionNode.Action != null` — "Nested SectionNode.Action"
  - Headingless sections substitute the literal `(headingless)` in messages.
- `ShellResponse<TState>.Validate()` now invokes `ValidateSectionAction(Vm)` alongside the existing `ValidateActionNames(Vm)` call. **Deviation from the plan:** the plan said "ctor invokes" but the existing pattern calls validation from `.Validate()`, not the ctor. Applied Rule 1 — matched the existing seam to avoid drift.
- **Commit:** `b129a1c feat(260614-9hq): add SectionNode.Action + ValidateSectionAction (.NET)`

### Task 3 — jsdom test suite + TS validateSectionAction

- `viewmodel-shell/test/section-action.test.ts` (12 cases) is a structural mirror of `test/table-row-action.test.ts`:
  - A: click anywhere dispatches `select-card-1`
  - B: Enter dispatches
  - C: Space dispatches + `preventDefault`s
  - D: Tab does NOT dispatch
  - E/F/G: containment for nested ButtonNode / CheckboxNode / LinkNode — none also fires the card action
  - H: ARIA shape (`role="button"`, `tabindex=0`, `aria-label="Onboarding"` from heading)
  - I: headingless variant derives `aria-label` from descendant text; fully-empty section falls back to `"Card"`
  - J: backward-compat baseline — a section without `action` has no `--clickable` class, no `tabindex`, no `role`, no `aria-label`
  - K: `action + collapsible:true` throws via `validateSectionAction`
  - L: nested `action` throws; styling-only inner card with internal buttons passes
- `viewmodel-shell/src/server.ts` gains `validateSectionAction` (TS twin of the .NET walk) and wires it into `createAction`'s tree-validation gate alongside `validateActionNames`. Same `invalid_tree` exit path (500).
- **Drive-by Rule-1 fix:** The plan's TSDoc said "internal whitespace collapsed to ' · ' separator" for `aria-label` text derivation, but that mangled normal text like "Choose plan" into "Choose · plan". The renderer now collapses whitespace runs to a single space — preserving "Choose plan" intact. The `· `-separator idiom is a table-cell pattern (joining DISTINCT cells) that doesn't translate to descendant-text flattening. Documented inline in the renderer code.
- 275 vitest tests pass | 1 skipped.
- **Commit:** `ae71360 test(260614-9hq): jsdom test suite + TS validateSectionAction`

### Task 4 — .NET tree-validation tests

- `viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs` appends six new `[Fact]`s:
  - `Validate_SectionAction_Plain_Passes` — clickable card with descendants is valid
  - `Validate_SectionAction_PlusCollapsible_Throws` — asserts message contains literal `"both Action and Collapsible: true"` + the heading name
  - `Validate_SectionAction_PlusCollapsible_HeadinglessLabel` — asserts headingless sections substitute the literal `"(headingless)"`
  - `Validate_SectionAction_Nested_Throws` — asserts message contains `"Nested SectionNode.Action"` + both `"Outer"` + `"Inner"`
  - `Validate_SectionAction_StylingOnlyInnerCard_Passes` — pins the locked decision that `Variant:"card"` inner section (no Action) with internal buttons inside a clickable card is VALID
  - `ShellResponse_Validate_RunsSectionActionValidation` — pins the `ShellResponse<TState>.Validate()` seam, mirroring the existing `ShellResponse_Validate_RunsTheWalker_OnDuplicate_Throws` pattern. **Naming deviation:** the plan named it `ShellResponse_Ctor_RunsSectionActionValidation`, but the validation runs in `.Validate()` (not the ctor) — see Task 2.
- 51 .NET tests pass (was 45).
- **Commit:** `606a7dd test(260614-9hq): .NET tree-validation tests for SectionNode.Action`

### Task 5 — Parity fixture coverage

- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`: `FeatureProbeState` gains an `int CardClickCount` field; `BuildVm` renders a new `SectionNode("Clickable Card", Variant: "card", Action: select-card)` showing the click counter; the dispatch switch adds a `"select-card"` arm.
- `demo/FeatureProbe-bun/handler.ts`: identical changes on the bun twin.
- `parity/fixtures/feature-probe.json`: three new steps — `fresh-card` (freshState), `card-click-1` (POST select-card), `card-click-2` (POST again, counter now 2). Both backends must emit byte-identical wire including the new `action` field on the SectionNode.
- **Parity run confirms all backends agree** — verified locally via `bun run parity/run.ts`. Output ended with `✓ Parity tests passed`.
- **Bun-link side-effect:** had to register the worktree as the global `bun link` target to make the parity run pick up new types; restored the main-repo link after the run to avoid pollution.
- **Commit:** `4a963dc feat(260614-9hq): parity coverage for SectionNode.action via FeatureProbe`

### Task 6 — CHANGELOG + MIGRATION + version bumps

- `viewmodel-shell/package.json` version `1.3.0` → `1.4.0`. `package-lock.json` re-synced via `npm install --package-lock-only`.
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>` `1.2.0` → `1.3.0`.
- `CHANGELOG.md` prepends a new `## 1.4.0 / 1.3.0 — SectionNode.action clickable cards` entry citing issues #19 + #20, with Added / Demo migration / Tests / Consumers sections in the same voice as the existing 1.2.0 entry.
- `MIGRATION.md` prepends a new `## Upgrading to '1.4.0' / '1.3.0' (lockstep — npm + NuGet)` entry with: version-bump table, one-paragraph "what changed", explicit "Consumer action required: none.", Not breaking subsection, and a New capability subsection with copy-pasteable TS + C# snippets plus a "what the framework rejects" subsection.
- Old entries untouched (release-gated rule per AGENTS.md).
- **NOT published** — per AGENTS.md "Working agreement for agents" the version bump alone is not a release; publishing is a separate operator step.
- **Commit:** `a442611 chore(release): viewmodel-shell 1.4.0 / NuGet 1.3.0 — SectionNode.action`

### Task 7 — Showcase demo clickable cards

- **Taken** — `demo/Showcase/frontend/src/main.ts` Dashboard archetype's four stat tiles (Revenue, Active users, Conversion, Open issues) gain `action: { name: "dashboard:focus-<tile>" }`. The card surface is the click target; per-tile identity is encoded in the action name, no `context` field, consistent with the Phase-6 wire and the `TableRow.action` idiom.
- The Showcase's existing `handle()` logs unknown action names to console — that's the demo's behavior; the visual click affordance (hover ring, focus outline, cursor: pointer) IS the canonical worked example. No state record change needed.
- `npm run build` produces a clean Vite build (17 modules, 12 kB gzipped JS).
- **Commit:** `64a38d2 feat(260614-9hq): Showcase Dashboard stat tiles use SectionNode.action`

## Files touched

- `viewmodel-shell/src/index.ts` — SectionNode.action field declaration
- `viewmodel-shell/src/browser.ts` — section renderer wires click + keyboard + ARIA + containment
- `viewmodel-shell/src/server.ts` — validateSectionAction tree walk + createAction wiring
- `viewmodel-shell/styles/default.css` — .vms-section--clickable cursor / hover ring / focus-visible outline
- `viewmodel-shell/test/section-action.test.ts` — 12 jsdom cases (new file)
- `viewmodel-shell/package.json` — version 1.3.0 → 1.4.0
- `viewmodel-shell/package-lock.json` — re-synced to 1.4.0
- `viewmodel-shell-dotnet/ViewModels.cs` — SectionNode.Action positional param + ValidateSectionAction + Validate() wiring
- `viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs` — 6 new .NET facts
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` — Version 1.2.0 → 1.3.0
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — CardClickCount state field + clickable card section + select-card arm
- `demo/FeatureProbe-bun/handler.ts` — bun twin
- `demo/Showcase/frontend/src/main.ts` — Dashboard stat tiles become clickable
- `parity/fixtures/feature-probe.json` — three new steps exercising select-card
- `CHANGELOG.md` — new 1.4.0 / 1.3.0 entry
- `MIGRATION.md` — new 1.4.0 / 1.3.0 entry

## Test status

- TypeScript build clean (`npx tsc -b tsconfig.tui.json` — exit 0).
- All five `npm run check:*` guards green: core-globals, aa-contrast (13/13 pairs on default + all 12 themes), theme-byte-identity, theme-function, no-demo-style.
- vitest: **275 passed | 1 skipped** across 22 test files (was 263 before — the 12 new section-action tests are accounted for).
- dotnet test: **51 passed** (was 45 — the 6 new SectionNode.Action validation facts are accounted for).
- Parity: **all backends agree** across every fixture (verified locally via `bun run parity/run.ts`).
- .NET package builds clean (`dotnet build AshleyShrok.ViewModelShell.csproj -c Release` — 0 warnings, 0 errors).
- All .NET demos build clean (positional call sites compile unchanged — verified by building HelpDesk + FeatureProbe).

## Deviations from plan

1. **Validation seam: `.Validate()` not the ctor.** Plan Task 2 said the `ShellResponse<TState>` ctor invokes `ValidateSectionAction`, but the existing codebase pattern calls `ValidateActionNames` from the `.Validate()` method (the ctor never runs validation — by design, because that allows constructing redirect responses with no Vm without paying validation cost). Matched the existing seam to avoid divergence. Applied Rule 1 (bug fix to plan instruction that contradicted existing pattern). The .NET test was renamed `ShellResponse_Validate_RunsSectionActionValidation` to match.

2. **aria-label whitespace collapse to single space, not ` · `.** The plan's renderer TSDoc said "internal whitespace collapsed to ' · ' separator" but this mangled "Choose plan" into "Choose · plan" — `el.textContent` flattens descendant nodes without preserving cell boundaries, so the `· `-separator idiom (which works for TableRow because it joins DISTINCT cells) is wrong here. Renderer now collapses whitespace runs to a single space, preserving normal in-text spacing intact. Documented inline in the code. Applied Rule 1 (bug fix); the in-renderer comment explains why for the next maintainer.

3. **Bun link side-effect.** The worktree's bun packages use `link:` symlinks resolved via a global registry (`~/.bun/install/global/`); running the parity suite from the worktree required temporarily registering the worktree as the link target. The main-repo link was restored after the parity run completed.

No deviations from the locked decisions (variant=card+collapsible disjoint; nested action-in-action invalid; styling-only inner card valid; lockstep MINOR; Showcase opt-in).

## Authentication gates

None — pure code change, no external credentials required.

## Self-Check: PASSED

All 16 modified/created files exist on disk; all 7 task commits are present in git log.
