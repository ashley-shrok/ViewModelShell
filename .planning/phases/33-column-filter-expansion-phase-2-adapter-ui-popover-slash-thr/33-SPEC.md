# Phase 33: Column filter expansion Phase 2 — Adapter UI + demo migration + release — Specification

**Created:** 2026-08-18
**Ambiguity score:** 0.13 (gate: ≤ 0.20)
**Requirements:** 14 locked

## Goal

Ship the user-facing surface of the typed column-filter capability whose additive wire vocabulary + reference truth function landed in Phase 32: the always-visible-input + escalation-popover browser adapter (Round 2 hybrid shape), the filter-icon state grammar with the new `filter-slash` glyph, the migration of every existing consumer to the new wire, the removal of the old wire fields, and the aligned major-version release (npm + NuGet + `Markdown` companion) with Poppy piloting on PBMInvoices.

## Background

**Phase 32 delivered the additive foundation and staged the CHANGELOG under `## Unreleased`.** On both backends, the new `TableColumn.filter?: FilterSpec` declaration + `TableNode.filterDescriptorBinds?` state pointer + `FilterDescriptor` shape + per-type operator vocabularies now coexist with the old `filterable`/`filterValue`/`filterBinds`/`filterAction` fields. The `matchesFilter` reference truth function (`viewmodel-shell/src/server.ts`) and its .NET twin (`FilterHelper.MatchesFilter` in `viewmodel-shell-dotnet/FilterHelper.cs`) are byte-parallel and NASA-tested (162 TS + 126 .NET cases + 101-case cross-backend parity fixture + REQ-CF1-07 mutation-verify documented).

**Nothing yet renders the new capability.** The browser adapter (`viewmodel-shell/src/browser.ts`) still reads only the old fields (references at `browser.ts:4409, 5553-5554, 5691-5724`); the TUI (`viewmodel-shell/src/tui.tsx:1390-1395`) does the same. The old wire is fully functional. Consumer code today (Showcase, HelpDesk, HelpDesk-bun, FeatureProbe .NET + bun, ExpenseTracker.Tests) references the old fields exclusively. The new shape ships on the wire but is dark on-screen.

**Phase 33 flips the surface on, kills the old wire, migrates every consumer, and releases the major.** Per the shape doc (`.planning/design/shape-column-filter-expansion.md`) Round 2 hybrid: always-visible inline input + filter button per column, popover for escalation (operator picker + typed value input + add-rule + all-of/any-of joiner + Apply/Clear footer), icon state grammar (slash-through when unset, plain funnel when set, plain funnel + dot when escalated beyond a simple inline contains), popover pre-loads the inline value on open, outside-click discards, Apply commits, portal positioning escapes the table-wrapper's `overflow-x: auto` clip, keyboard Tab/Enter/Escape support, inline read-only summary when popover state is nontrivial. Wire replaces (not extends) — old fields removed — driving the aligned major-version bump.

**Consumer pilot:** Poppy/PBMInvoices volunteered on the release; announcement + her migration land on the same release.

## Requirements

1. **REQ-CF2-01 — Always-visible input + filter button per filterable column.** The browser adapter renders both affordances side by side in each filterable column's filter row, per the Round 2 hybrid shape.
   - Current: `browser.ts:5691-5724` renders a single text input per column bound to `filterBinds[col.key]`, dispatching `filterAction` on Enter (single-affordance today-shape); no filter button, no popover surface.
   - Target: Each filterable column's filter row renders (a) an always-visible inline input reading its current value from the column's `FilterDescriptor` at `filterDescriptorBinds[col.key]` (contains-rule short-circuit — display an empty string when the descriptor has zero rules or exactly one contains rule with a string value; that value round-trips on typing + Enter), and (b) a filter icon button adjacent to it that opens the popover on click.
   - Acceptance: Adapter test (jsdom-driven) — a `TableNode` with `filterDescriptorBinds` + a filterable column renders both an `<input>` and a filter-icon `<button>` inside the filter row cell for that column; typing text + Enter dispatches an action that writes a single `{operator:"contains", value:"..."}` rule at that column's bind path.

2. **REQ-CF2-02 — Filter icon state grammar (three states) + new `filter-slash` shipped glyph.** The filter icon's rendered glyph reflects the column's filter state at a glance.
   - Current: No filter icon exists in the adapter; icon inventory (`viewmodel-shell/src/icons-payload.ts`) has no funnel-slash glyph.
   - Target: `filter-slash` glyph added to `icons-payload.ts` (SVG payload, sized + styled per existing icon conventions). Adapter renders (a) `filter-slash` when the column's `FilterDescriptor` has zero rules OR is absent, (b) plain funnel (existing `filter` glyph) when the descriptor has exactly one contains rule with a value, (c) plain funnel + small dot (composed CSS overlay OR a dot glyph on top of the funnel) when the descriptor is escalated beyond that — >1 rule, OR a single non-contains rule, OR a single contains rule with any non-default matching hint.
   - Acceptance: Adapter tests assert the emitted class or SVG identifier per state across all three cases; `filter-slash` glyph accessible via the shipped icon-payload lookup; served verification page shows all three states visually.

3. **REQ-CF2-03 — Popover rendering.** Opening the popover shows the escalation surface for building a multi-rule filter.
   - Current: No popover renders anywhere in the adapter for filtering.
   - Target: Popover, opened by the filter button, contains: (a) an operator picker `<select>` typed to the column's declared value-kind (its options are the closed operator vocabulary for that kind from Phase 32's per-type unions); (b) a typed value input per rule matched to the rule's operator — text `<input>` for text/number contains/starts-with/ends-with; number `<input type="number">` for numeric comparators; date `<input type="date">` for date operators; a `<select>` (single OR multiple, adapter picks) for fixed-set is/is-not; a boolean toggle for yes-no is-true/is-false; no value slot for is-empty/is-not-empty; (c) an add-rule button that appends an empty rule with the type's default operator (`contains` for text, `equals` for number/date/fixed-set/yes-no); (d) an all-of / any-of joiner toggle rendered only when the descriptor has >1 rule; (e) a footer with Clear (clears the descriptor) + Apply (commits to state) buttons.
   - Acceptance: Adapter test opens the popover, renders each of the 5 value-kinds' popover contents, asserts operator picker options match the closed vocabulary, asserts add-rule appends and the joiner appears only at >1 rule.

4. **REQ-CF2-04 — Popover interactions.** The popover behaves per the shape doc's canonical flow.
   - Current: N/A (no popover exists today).
   - Target: (a) On open, the popover pre-loads the inline input's current value as its first rule (a `contains` rule with the typed value) — inline is a shortcut into popover state, not a separate filter; (b) outside-click discards any in-progress rule changes without committing to state; (c) Apply commits the current rule set to state at the column's bind path and closes the popover; (d) Escape closes the popover and discards (same as outside-click); (e) Clear empties the descriptor to zero rules (this is a distinct action from close-and-discard).
   - Acceptance: Adapter test drives each of the five interactions (open, outside-click-discard, apply-commit, escape-discard, clear-commit-empty) and asserts state after each.

5. **REQ-CF2-05 — Popover positioning + keyboard.** The popover renders without the table wrapper's overflow clip, and keyboard users can drive the full flow.
   - Current: N/A.
   - Target: (a) The popover portals out of the table wrapper (which is `overflow-x: auto` per today's table styling) — cell-scoped positioning contexts don't reliably escape the thead/wrapper clipping; renderer inserts the popover into a `body`-level container (or equivalent portal target) with positioning anchored to the button's bounding client rect; (b) keyboard support — Tab moves between inputs within the popover, Enter in the inline input commits its contains value (unchanged from today), Escape closes the popover, focus returns to the filter button on close.
   - Acceptance: Adapter test opens a popover in a table with an overflow-clip parent and asserts the popover DOM node is NOT a descendant of the clipped wrapper; keyboard test asserts Tab / Enter / Escape behavior + focus restoration.

6. **REQ-CF2-06 — Inline read-only summary when popover state is nontrivial.** When the descriptor holds anything more complex than a single default-operator single-value rule, the inline input displays a read-only compact summary instead of a bare typed value.
   - Current: N/A.
   - Target: When the descriptor is nontrivial (>1 rule, OR a single rule with a non-default operator, OR a single rule with a non-empty matching-hints set), the inline input renders as a read-only span (or read-only `<input>`) with italic muted styling showing a compact expression — e.g., `contains "foo" AND >100`, `is empty`, or `starts-with "abc"`. The user cannot type into it in this state; escalation edits happen only through the popover.
   - Acceptance: Adapter test asserts the read-only summary renders correctly for at least four descriptors representative of the nontrivial-state cases; asserts a trivial descriptor (empty OR single-contains) renders the editable inline input instead.

7. **REQ-CF2-07 — Removal of old wire fields (all 8).** The additive coexistence contract ends: the old wire is gone from both backends.
   - Current: On the TypeScript side, `TableColumn.filterable`, `TableColumn.filterValue`, `TableNode.filterBinds`, `TableNode.filterAction` are still present in `viewmodel-shell/src/index.ts` (Phase 32 preserved them). On the .NET side, `TableColumn.Filterable`, `TableColumn.FilterValue`, `TableNode.FilterBinds`, `TableNode.FilterAction` are still present in `viewmodel-shell-dotnet/ViewModels.cs`.
   - Target: All 8 fields removed. The type-source of truth in each backend contains only the new `filter?: FilterSpec` + `filterDescriptorBinds?: Record<string, string>` fields (or their `.NET` casing equivalents). No compatibility shims, no aliases.
   - Acceptance: `grep -nE "\\b(filterable|filterValue|filterBinds|filterAction)\\b" viewmodel-shell/src/index.ts` returns zero matches; `grep -nE "\\b(Filterable|FilterValue|FilterBinds|FilterAction)\\b" viewmodel-shell-dotnet/ViewModels.cs` returns zero matches; framework tests + parity + demo type-check green with the removals.

8. **REQ-CF2-08 — Demo migration (all 7 files).** Every existing consumer of the old wire migrates to the new shape; all demo tests green.
   - Current: 7 files identified via grep reference the old wire and would fail to compile after REQ-CF2-07 lands: TS — `demo/Showcase/frontend/src/main.ts` (2 columns), `demo/HelpDesk-bun/server.ts`, `demo/FeatureProbe-bun/handler.ts`; .NET — `demo/HelpDesk/AspNetCore/AgentController.cs`, `demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs`, `demo/ExpenseTracker/AspNetCore.Tests/ExpensesControllerTests.cs`, `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`.
   - Target: Each of the 7 files declares its filter columns with the new `filter: {...}` block + a `filterDescriptorBinds` map, and its action handler invokes the truth function (`matchesFilter` / `FilterHelper.MatchesFilter`) instead of the old bespoke filtering logic. HelpDesk's agent queue tabs get an explicit before/after visible in the diff (used later as the MIGRATION.md reference).
   - Acceptance: All 7 files' associated test suites pass under `dotnet test` (for .NET tests) or the demo type-check / demo run (for TS demos). No file in the repo references any of the 8 old wire fields.

9. **REQ-CF2-09 — TUI: old-wire filter row commented out (refresh deferred).** The TUI does not block compile; a follow-up phase is captured for its filter-row refresh.
   - Current: `viewmodel-shell/src/tui.tsx:1390-1395` references `c.filterable` and `c.filterValue` to render `[filter]` / `[value]` labels; removing the old wire will break the TUI compile.
   - Target: The `tui.tsx` filter row block is commented out (or the offending lines conditionally guarded to no-op) with a code comment naming the follow-up ("TUI filter refresh — Phase TBD; see bounty `tui-filter-refresh`"). A bounty is created under `~/.claude/roles/vms-maintainer/bounties/tui-filter-refresh/` capturing the deferred work — refresh the TUI filter row to the new wire shape (still `[filter]` / `[value]` labels, but reading from `filterDescriptorBinds`). No new UI grammar in the TUI, no popover, no icon states.
   - Acceptance: `viewmodel-shell` builds clean (`npm run check:test-types` + `npx vitest run`) after REQ-CF2-07's removal; `~/.claude/roles/vms-maintainer/bounties/tui-filter-refresh/bounty.json` exists with `status:"in_progress"`; the `tui.tsx:1390-1395` region contains an explicit follow-up comment.

10. **REQ-CF2-10 — In-process adapter tests (VMS blind-drive).** Adapter behavior for the new filter surface is covered by in-process tests without a running browser.
    - Current: No adapter tests exist for the filter surface (Phase 32's tests covered the truth function + wire types only).
    - Target: New adapter test file (or a new suite within an existing `viewmodel-shell/test/*.test.ts`) covering, at minimum: (a) type-and-enter contains flow (parity with today's behavior, new state shape); (b) escalate-via-popover multi-condition flow; (c) is-empty on every value-kind; (d) contains-on-non-string-kind type-narrowing case (e.g., contains "2026" on a date column returns matches — proves the type-narrowing floor); (e) icon state transitions across all three states; (f) popover pre-load-from-inline; (g) popover discard-on-outside-click, discard-on-Escape, apply-on-Apply, clear-commits-empty; (h) keyboard flow (Tab / Enter / Escape / focus restoration).
    - Acceptance: The new adapter test suite runs green under `npx vitest run`; every requirement in REQ-CF2-01..06 has at least one asserting test in this suite; mutation-verify session: reverting the outside-click-discard handler to commit-instead makes at least one test go red.

11. **REQ-CF2-11 — Docs: MIGRATION.md wire replacement + AGENTS.md new-primitive section + CHANGELOG version header.**
    - Current: `MIGRATION.md` has no entry for the filter wire change; `AGENTS.md` has no section describing the typed column-filter primitive; `CHANGELOG.md` still carries the Phase 32 additions under `## Unreleased`.
    - Target: (a) `MIGRATION.md` gets a new section for the release describing the wire replacement — the 8 removed fields + their new-shape replacements + a HelpDesk agent-queue before/after code snippet + a "consumer must upgrade on this major" note; (b) `AGENTS.md` gets a new section describing the typed column-filter primitive — both the wire shape (recapping Phase 32) and the new UI grammar (the hybrid affordance, the icon state grammar, the popover semantics); (c) `CHANGELOG.md` promotes the `## Unreleased` section into a new versioned header (major-version bump — planner picks exact version at release time, aligned with the release-ritual step in REQ-CF2-12).
    - Acceptance: `MIGRATION.md`, `AGENTS.md`, `CHANGELOG.md` all committed with their new content; a diff review by Ashley confirms the wire replacement is accurately described.

12. **REQ-CF2-12 — Aligned release: npm + NuGet major-version bump published, `Markdown` companion rebuilt+republished with bumped floor dep, tag, advance `main`, `#vms-announcements` announce.**
    - Current: `main` at HEAD carries Phase 32 additions unpushed; `viewmodel-shell/package.json` and `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` still carry the pre-Phase-33 versions; `AshleyShrok.ViewModelShell.Markdown` companion has not been rebuilt for the new major.
    - Target: (a) Both packages bump to the same next-major version and publish to their registries per AGENTS.md's publishing runbook (`npm publish` + `dotnet nuget push`); (b) `AshleyShrok.ViewModelShell.Markdown` gets a patch bump, rebuilt with its `<PackageReference>` floor dep to the new core major, and republished — per gotcha #9's rule that a companion packed against core vN carries `newobj` opcodes that fail-loud under vN+1; (c) annotated tag `v<major>.0.0` at the release commit; (d) `main` advanced to the release commit (verified via `git merge-base --is-ancestor v<major>.0.0 main`); (e) release-line posted to `#vms-announcements` (`!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net`) mirroring the CHANGELOG entry.
    - Acceptance: `curl` to `https://registry.npmjs.org/@ashley-shrok/viewmodel-shell` returns the new major as the `latest` dist-tag; `curl` to `https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json` returns the new major as the last version; same for `ashleyshrok.viewmodelshell.markdown`; `git tag -l v<major>.0.0` returns the tag; `main` on origin contains the release commit; the `#vms-announcements` room shows the release line.

13. **REQ-CF2-13 — Full green-tree gate green before commit + before release.** No push, no publish, no tag on a broken tree; no exception for "pre-existing" or "unrelated" failures.
    - Current: Phase 32 close ran the full 11-command gate green (per 32-04 SUMMARY).
    - Target: The full green-tree gate per AGENTS.md's "NEVER PUBLISH OR PUSH ANYTHING BROKEN" rule runs green (a) after the adapter build lands + demo migration lands + TUI comment-out lands + old-wire removal lands — the entire code delta — before commit; and (b) again at release-preflight, per Ashley's release-ritual authorization. Additionally, `.github/workflows/parity.yml` runs green in CI on the release commit.
    - Acceptance: All 11 gate commands exit 0 locally; CI green on the release commit; documented in the phase SUMMARY.

14. **REQ-CF2-14 — Served verification page: real-browser exercise gates commit/publish/tag/announce.** Ashley's real-browser exercise is the pre-ship gate per standing role directive.
    - Current: No verification page for Phase 33 exists yet.
    - Target: A verification page served on the tailnet (`http://100.113.23.63:<port>/`) that uses the real bundle (`viewmodel-shell/dist/browser.js`) + shipped CSS (`default.css` + at least one theme file for the theme-swap sanity check) + an in-page reducer mirroring an action handler that invokes `matchesFilter`. The page contains at least three tables covering: (i) all 5 value-kinds × always-visible-input contains-and-enter grammar, (ii) popover flow — operator picker + add-rule + all-of/any-of toggle + Apply/Clear + outside-click-discard + Escape-discard + pre-load-inline, (iii) icon-state grammar across the 3 states + slash-through glyph rendering. Links to the migrated HelpDesk + Showcase demos accompany the page so Ashley can exercise migration in situ. Ashley exercises the page in a real browser BEFORE any of commit / push / publish / tag / announce.
    - Acceptance: The verification-page URL is served over the tailnet; Ashley confirms real-browser exercise (a plain "taste ok" is sufficient); no commit / push / publish / tag / announce happens before her confirmation.

## Boundaries

**In scope:**
- Browser adapter (`viewmodel-shell/src/browser.ts`) — always-visible inline input + filter button + icon state grammar + popover rendering + popover interactions + portal positioning + keyboard support + inline read-only summary
- New shipped icon glyph `filter-slash` in `viewmodel-shell/src/icons-payload.ts`
- Removal of all 8 old wire fields (4 TS + 4 .NET) from `viewmodel-shell/src/index.ts` and `viewmodel-shell-dotnet/ViewModels.cs`
- Demo migration of all 7 identified files (Showcase, HelpDesk .NET + bun, HelpDesk .NET Tests, ExpenseTracker .NET Tests, FeatureProbe .NET + bun)
- TUI (`viewmodel-shell/src/tui.tsx`) — minimum change to keep the framework compilable after wire removal (comment-out block + follow-up bounty captured)
- In-process adapter tests (VMS blind-drive) for the new UI grammar
- Docs: MIGRATION.md wire-replacement entry, AGENTS.md new-primitive section, CHANGELOG version header
- Full green-tree gate green before commit + before release
- Served verification page + real-browser exercise gate
- Release ritual: aligned npm + NuGet major-version bump publish, Markdown companion rebuild+republish with bumped floor dep, tag, advance `main`, `#vms-announcements` announce
- Poppy pilot coordination — release announcement includes her, she migrates PBMInvoices on the same release

**Out of scope:**
- TUI filter-row refresh to the new wire shape — deferred to a follow-up phase captured in the `tui-filter-refresh` bounty (per Q1 answer 2026-08-18: "not going to do the terminal adapter update")
- Global "search everything" quick-filter box — shape doc "Out (v1)"
- Cross-column filter combining (`col A matches X OR col B matches Y`) — shape doc "Out (v1)"; across-column combination stays implicit-and
- Nested filter groups within a column or across (`(A AND B) OR (C AND D)`) — shape doc "Out (v1)"
- Multi-value operators like "is any of" / "is none of" — shape doc "Out (v1)"; expressed via AND/OR of "is" rules instead
- Chip strip below the table showing active filters as removable pills — shape doc "Out (v1)"
- More matching hints beyond `ignore-punctuation` (case-sensitive opt-in, ignore-whitespace, ignore-diacritics) — shape doc "Deferred"; add on real consumer signal
- Auto-inferring column type from cell content — shape doc "Tempting but no"
- Auto-populating fixed-set options from distinct row values — shape doc "Tempting but no"
- Custom-operator registration by apps — shape doc "Tempting but no"; closed enum for v1
- Free-form filter expression language — shape doc "Tempting but no"; breaks structured-wire contract
- New matching-hints beyond the single `ignore-punctuation` shipped in Phase 32
- Any framework machinery for the per-column truth-function override (per Phase 32 D-04: consumers call the helper or don't; no strategy registry, no override slot)
- Wire-shape changes beyond removal — the new-shape wire additions all landed in Phase 32; Phase 33 removes the old and adds no new wire fields

## Constraints

- **Wire is breaking.** The removal of the 8 old fields drives an aligned major-version bump on both npm + NuGet. Compatibility shims are explicitly disallowed — the breaking change is the point (it enables the new capability). Consumer pilot (Poppy/PBMInvoices) migrates on the same release.
- **Real-browser exercise gate is hard.** Ashley's real-browser exercise on the served verification page MUST precede commit / push / publish / tag / announce. Headless-chrome iteration is encouraged but never substitutes (standing role directive 2026-08-06).
- **Full green-tree gate is non-negotiable.** All 11 commands per AGENTS.md's rule pass before release. "Pre-existing" / "unrelated" / "just a demo" failures are NOT exceptions.
- **Popover positioning MUST portal out of the table wrapper.** The table wrapper is `overflow-x: auto`; cell-scoped stacking contexts don't reliably escape the thead clipping (documented as the tasting's popover-positioning lesson in the shape doc). Any implementation that renders the popover as a descendant of the clipped wrapper fails REQ-CF2-05.
- **Companion NuGet rebuild is mandatory.** Per AGENTS.md gotcha #9, `AshleyShrok.ViewModelShell.Markdown` is rebuilt with a bumped floor dep and republished in the same release session — a companion packed against core vN carries `newobj` opcodes that fail-loud under vN+1 despite in-tree `<ProjectReference>` gates seeing it green.
- **Icon-glyph name locked to `filter-slash`** (Q2 answer 2026-08-18) — matches the "slash-through funnel" language in the shape doc; semantically distinct from `filter-off` (which would read as "filter disabled" rather than "filter empty").
- **Poppy pilot coordination** — the `#vms-announcements` announce is timed so Poppy can migrate PBMInvoices on the same release; her Kara-level operator feedback loops back into a possible follow-up patch.
- **`## Unreleased` promotion is single-shot** — the Phase 32 `## Unreleased` entry gets promoted into the new versioned header alongside Phase 33's own additions in the same CHANGELOG edit.

## Acceptance Criteria

- [ ] `grep -nE "\\b(filterable|filterValue|filterBinds|filterAction)\\b" viewmodel-shell/src/index.ts` returns zero matches
- [ ] `grep -nE "\\b(Filterable|FilterValue|FilterBinds|FilterAction)\\b" viewmodel-shell-dotnet/ViewModels.cs` returns zero matches
- [ ] All 7 identified consumer files migrated to the new wire; all their tests pass
- [ ] `viewmodel-shell/src/icons-payload.ts` contains a `filter-slash` glyph accessible via the shipped icon-payload lookup
- [ ] Browser adapter renders the always-visible input + filter button + all three icon states + the popover with all typed value inputs, per REQ-CF2-01..06
- [ ] Popover DOM node is not a descendant of the table wrapper's overflow-clip parent (portal positioning verified)
- [ ] Keyboard flow (Tab / Enter / Escape / focus restoration) works per REQ-CF2-05
- [ ] Inline read-only summary renders for nontrivial descriptor states per REQ-CF2-06
- [ ] `tui.tsx` filter-row block commented out with an explicit follow-up reference; `viewmodel-shell` builds clean
- [ ] `~/.claude/roles/vms-maintainer/bounties/tui-filter-refresh/bounty.json` exists with `status:"in_progress"`
- [ ] New in-process adapter test suite passes under `npx vitest run`; mutation-verify session documented in phase SUMMARY
- [ ] `MIGRATION.md` contains a new section for this release with the wire replacement + HelpDesk before/after; `AGENTS.md` has a new section describing the typed column-filter primitive
- [ ] `CHANGELOG.md` `## Unreleased` promoted to the new versioned major header
- [ ] All 11 green-tree gate commands per AGENTS.md exit 0
- [ ] Served verification page live on the tailnet before commit/publish/tag/announce
- [ ] Ashley confirms real-browser exercise ("taste ok" or equivalent) BEFORE commit/publish/tag/announce
- [ ] npm publish successful — new major visible as `latest` dist-tag at `https://registry.npmjs.org/@ashley-shrok/viewmodel-shell`
- [ ] NuGet publish successful — new major visible as last version at `https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json`
- [ ] `AshleyShrok.ViewModelShell.Markdown` companion rebuilt + republished with bumped floor dep on the new core major, in the same release session
- [ ] Annotated tag `v<major>.0.0` created at the release commit and pushed
- [ ] `main` on origin advanced to the release commit; `git merge-base --is-ancestor v<major>.0.0 main` returns success
- [ ] Release-line posted to `#vms-announcements` (`!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net`) mirroring the CHANGELOG entry
- [ ] Poppy notified — she has the release version and the MIGRATION.md link, coordinated for her PBMInvoices upgrade

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                            |
|--------------------|-------|------|--------|------------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Round 2 hybrid shape locked; icon grammar locked; migration files enumerated |
| Boundary Clarity   | 0.90  | 0.70 | ✓      | TUI carved to follow-up phase (Q1); shape doc's Out (v1) / Deferred lists honored verbatim |
| Constraint Clarity | 0.80  | 0.65 | ✓      | Real-browser gate + green-tree gate + Markdown rebuild + Poppy coord all locked |
| Acceptance Criteria| 0.85  | 0.70 | ✓      | 22 pass/fail criteria; each REQ has a concrete falsifiable check |
| **Ambiguity**      | 0.13  | ≤0.20| ✓      |                                                                  |

## Interview Log

| Round | Perspective     | Question summary                                                | Decision locked                                                                 |
|-------|-----------------|-----------------------------------------------------------------|---------------------------------------------------------------------------------|
| 0     | Researcher (pre)| Prior artifacts (shape doc + plan doc + Phase 32 CONTEXT) already lock most of Phase 33's WHAT | Ambient recon before questions — scores initial ambiguity 0.2125, just above gate |
| 1     | Boundary Keeper | Q1: TUI in scope?                                               | Ashley: "not going to do the terminal adapter update" → REQ-CF2-09 (comment-out + follow-up bounty) |
| 1     | Boundary Keeper | Q2: Icon glyph name — `filter-slash` vs `filter-off`?           | Recommended `filter-slash` accepted (matches shape doc's slash-through language) |
| 1     | Boundary Keeper | Q3: Companion NuGet rebuild scope                               | Recommended in-scope accepted → REQ-CF2-12 (Markdown rebuild + republish)       |
| 1     | Boundary Keeper | Q4: Demo migration — enumerated 7 files; all in-scope?          | Recommended all-in accepted → REQ-CF2-08 (all 7 files migrate)                  |
| 1     | Boundary Keeper | Q5: Verification page scope                                     | Recommended 3-table shape accepted → REQ-CF2-14 (real-browser exercise gate)    |

Post-round-1 scores brought ambiguity from 0.2125 → 0.13.

---

*Phase: 33-column-filter-expansion-phase-2-adapter-ui-popover-slash-thr*
*Spec created: 2026-08-18*
*Next step: /gsd:discuss-phase 33 — implementation decisions (popover component structure, portal-mount mechanism, adapter test pattern, release version resolution, etc.)*
