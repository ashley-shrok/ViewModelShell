# Phase 33: column-filter expansion Phase 2 — Adapter UI + demo migration + release — Context

**Gathered:** 2026-08-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the user-facing surface of the typed column-filter capability whose additive wire vocabulary + reference truth function landed in Phase 32: the browser adapter's always-visible-input + escalation-popover Round 2 hybrid shape, the filter-icon state grammar (slash / plain / plain+dot) with the new shipped `filter-slash` glyph, portal-mounted popover positioning that escapes the table wrapper's overflow-x clip, in-process adapter tests covering the UI grammar, migration of every existing consumer to the new wire, removal of the 8 old wire fields, TUI carved to a follow-up bounty, MIGRATION.md + AGENTS.md + CHANGELOG version-header docs, and the aligned major-version release (npm + NuGet + `Markdown` companion) with Poppy piloting on PBMInvoices.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**14 requirements are locked.** See `33-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `33-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
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

**Out of scope (from SPEC.md):**
- TUI filter-row refresh to the new wire shape — deferred to a follow-up phase captured in the `tui-filter-refresh` bounty (Q1 answer 2026-08-18)
- Global "search everything" quick-filter box; cross-column filter combining; nested filter groups; multi-value `is any of` / `is none of` operators; chip strip below the table (all shape doc "Out (v1)")
- More matching hints beyond `ignore-punctuation` (shape doc "Deferred")
- Auto-inferring column type from cell content; auto-populating fixed-set options from row data; custom-operator registration by apps; free-form filter expression language (shape doc "Tempting but no")
- New wire fields beyond the Phase 32 additions
- Framework machinery for per-column truth-function override (Phase 32 D-04: consumers call the helper or don't; no strategy registry)

</spec_lock>

<decisions>
## Implementation Decisions

### D-01 (Popover architecture: client-only transient state, adapter-owned)

The popover is a **client-only adapter concern**. Its staged rule edits live in an internal `Map<colKey, DraftFilterDescriptor>` field on `BrowserAdapter` — the same pattern established by `fileRegistry`, `detailsOpenSnapshot`, `lookupOpenSnapshot`, `chartInstances`, `liveRegions`, `editorInstances`. On **Apply**, the draft flushes to state via the ordinary action-dispatch path (the same one every other bound input uses to round-trip its value); on **outside-click / Escape**, the draft is dropped without dispatching.

**Wire consequence:** No new wire node. The wire only ever sees the applied `FilterDescriptor` at the column's bind path from `filterDescriptorBinds` — same shape as any other bound state. This matches the framework's design philosophy #2 ("the structured description must always be enough on its own") — a wire consumer (agent) that reads the tree without ever opening the popover still sees the current applied filter descriptor at the bind path.

**Rejected alternative:** A `PopoverNode` wire node with server-driven open/close would push transient UI state onto the wire, breaking the "state on tree" pattern and adding cognitive load to agents driving the app blind (they'd have to model popover open/close as tree changes rather than as invisible browser affordance).

**Planner note:** The draft-Map lives on `BrowserAdapter`. Key by column bind path (the `filterDescriptorBinds[colKey]` value) so drafts survive re-renders — same principle as `fileRegistry`.

### D-02 (Portal mount target: adapter-created `.vms-popover-portal` sibling)

The popover DOM node mounts into a single `<div class="vms-popover-portal">` created by `BrowserAdapter` on construction (in the constructor, alongside the existing `container.replaceChildren(...)` initialization). This div is appended to the shell's container element — the same element the app hands to `new BrowserAdapter(container)`.

**Positioning consequence:** The portal div is a SIBLING of the table wrapper (not a descendant), so it escapes the table wrapper's `overflow-x: auto` clip by construction. Popover DOM appends into the portal on open, removes on close.

**Rejected alternatives:**
- `document.body` directly — leaks framework DOM outside the app-owned container root; complicates test teardown (jsdom `document.body` is shared across tests).
- Ancestor search for `data-vms-portal-root` — premature escape-hatch machinery; solves nothing until a real second use surfaces.

**Planner note:** The portal div MUST be created in the `BrowserAdapter` constructor (not lazily on first popover open) so `render()` calls that hit the portal see a stable target. Cleanup: the app removing its container element takes the portal with it — no explicit teardown code needed.

### D-03 (Positioning strategy: `position: fixed` + `getBoundingClientRect()` + JS clamping)

Popover position computed by JS at open time:
1. `getBoundingClientRect()` on the filter-button trigger.
2. Popover placed with `position: fixed` at `top: rect.bottom + gap` / `left: rect.left`.
3. **Viewport-edge clamping** — after append, measure the popover's own rect; if `right > window.innerWidth`, nudge `left` leftward by the overflow; if `bottom > window.innerHeight`, flip above the trigger (`top: rect.top - popoverHeight - gap`); if that also overflows, clamp to `top: gap` and let the popover scroll internally.
4. **Reposition on `window.resize` + `scroll`** (capture-phase scroll listener because the popover portal isn't a descendant of any scrolling ancestor) — re-run the same computation.

**Rejected alternatives:**
- CSS anchor positioning (`anchor-name` / `position-anchor`) — Chrome 125+ only; no Firefox — outside our polyfill-free posture.
- floating-ui / popper.js dep — new dependency; Ashley's banked tooltip lesson (2026-07-23) called out avoiding this bloat for the same reason (`AGENTS.md` "A 'known v1 limitation' that fires on FIRST USE is a defect ratified in prose").

**Verification bar:** The tooltip lesson explicitly says viewport-edge clipping is a first-use ship-blocker. This positioning implementation MUST be verified against a table near a viewport edge on the served verification page — a popover that clips is an in-phase defect, not a "known limitation."

**Planner note:** Adapter test for this includes a synthesized `getBoundingClientRect()` returning near-viewport-edge coordinates; assert the popover's computed `left` was nudged (not equal to trigger's `left`). Adapter test for the flip-above case with a rect near `window.innerHeight`.

### D-04 (Release version: 10.0.0 aligned on both packages; Markdown companion 0.2.3)

- **npm** (`@ashley-shrok/viewmodel-shell`): 9.2.1 → **10.0.0**
- **NuGet** (`AshleyShrok.ViewModelShell`): 9.2.0 → **10.0.0** (the 9.2.1 asymmetry from the npm-only wheel-adjust patch resolves at the major boundary)
- **NuGet** (`AshleyShrok.ViewModelShell.Markdown`): 0.2.2 → **0.2.3**, rebuilt with `<PackageReference>` floor dep bumped to `10.0.0` per gotcha #9 (a companion packed against core vN carries `newobj` opcodes that fail-loud at first-real-use under vN+1 despite in-tree `<ProjectReference>` gates seeing it green — Markdown 0.2.1 rebuild after core 8.0.0 is the precedent that banked the rule).
- **Semver-only signaling** — the major-line bump is the signal weight, not the number size. Rejected: bumping to 11.0.0 to "signal milestone weight" adds no semantic beyond what 10.0.0's major-line jump already conveys.

**Companion release order:** Core 10.0.0 publishes first (npm + NuGet); Markdown 0.2.3 publishes second in the same release session. Verify with the `curl` registry-read pattern per AGENTS.md publishing-runbook.

### D-05 (MIGRATION.md reference example: HelpDesk agent-queue tabs)

`demo/HelpDesk/AspNetCore/AgentController.cs`'s agent-queue table is the natural reference for the MIGRATION.md before/after example. It exercises both interesting kinds — Status column (fixed-set: `open`/`in-progress`/`closed` etc.) + Title column (text) — so the diff naturally covers `kind` declaration, per-type operator vocabulary, `filterDescriptorBinds` map wiring, and the `FilterHelper.MatchesFilter` call in the action handler.

**Diff shape in MIGRATION.md:**
- Before: `filterable: true, filterValue: state.filters.title` on TableColumn; `filterBinds: { title: "filters.title" }, filterAction: new ActionEvent("filter")` on TableNode; bespoke filter switch in action handler.
- After: `Filter: new FilterSpec("text")` on TableColumn; `FilterDescriptorBinds: new() { ["title"] = "filters.titleFilter" }` on TableNode; `FilterHelper.MatchesFilter(descriptor, cell, cellDisplay, kind)` in action handler.

**Planner note:** The migration of `AgentController.cs` (REQ-CF2-08) IS the source material for this section. The Wave-2 executor writing the migration should output a `MIGRATION-DRAFT.md` snippet alongside its commit, which the docs wave (Wave 3) folds into the final MIGRATION.md.

### D-06 (Adapter test file: `viewmodel-shell/test/filter-adapter.test.ts`)

New file at `viewmodel-shell/test/filter-adapter.test.ts` (byte-parallel with Phase 32's `test/column-filter.test.ts` naming). Uses jsdom + `new BrowserAdapter(container)` + a fake fetch that synthesizes action responses (existing pattern per `src/adapter.test.ts` and `test/*.test.ts`).

**Rejected alternative:** Extending `viewmodel-shell/src/adapter.test.ts` — that file is the general adapter test; the filter feature earns its own test file for the same reason Phase 32's truth-function tests earned `test/column-filter.test.ts`.

**Test coverage (per REQ-CF2-10 acceptance):**
- Type-and-enter contains flow (state written as `{operator:"contains", value:...}` rule)
- Escalate-via-popover multi-condition flow (Apply commits, outside-click discards)
- Is-empty on each of the 5 value-kinds
- Contains-on-non-string-kind type-narrowing (contains "2026" on a date column returns rows)
- Icon state transitions across the 3 states
- Popover pre-load-from-inline (open with a contains value in inline shows it as first rule)
- Discard-on-outside-click, discard-on-Escape, apply-on-Apply, clear-commits-empty
- Keyboard flow (Tab / Enter / Escape / focus restoration)
- **Mutation-verify session** documented in phase SUMMARY: reverting the outside-click-discard handler to commit-on-outside-click must make at least one test go red.

### Claude's Discretion

Areas where the planner has flexibility (spec-locked outcomes, mechanism unconstrained):

- **Exact `filter-slash` SVG geometry** — the shape (funnel with a diagonal slash line) is locked; the exact path coordinates + stroke width to match existing icon-payload conventions is a planner call.
- **Popover DOM structure** — element choices (`<div role="dialog">` vs `<dialog>` vs bare `<div>`; ARIA roles + attributes) are planner-picked to match the framework's existing overlay conventions. Grep `ModalNode` rendering in `browser.ts` for the closest precedent.
- **Inline read-only summary text format** — the SPEC gives examples (`contains "foo" AND >100`, `is empty`, `starts-with "abc"`); the exact template + join-word ("and" vs "AND" vs "&") is planner discretion.
- **Popover animation** (or absence thereof) — the framework's existing overlay convention is no CSS enter/exit animations; the popover follows the same.
- **Wave decomposition** — preview per D-08 below; planner refines.

### D-07 (Poppy pilot coordination timing)

Poppy is pilot for the release. Coordination order:
1. Full green-tree gate green + Ashley's real-browser exercise complete → commit lands on `main`.
2. Version bump commits + tag + `npm publish` + `dotnet nuget push` (both packages).
3. **DM Poppy** on relay (`!dKuMpeCcOqsMSPUIiZ:thenasty.taild9b663.ts.net`) with the release version + MIGRATION.md link (per AGENTS.md gotcha about ~600-char receiver truncation — keep load-bearing points early).
4. `#vms-announcements` post — release-line matching the CHANGELOG entry.
5. `main` advance verification via `git merge-base --is-ancestor v10.0.0 main`.

**Rationale:** DMing Poppy BEFORE the announce lets her surface any immediate breakage feedback in DMs (not in the announce room) that could inform a same-day follow-up patch. AGENTS.md role directive: "Sweep the relay for open promises BEFORE calling any batch done" — Poppy's pilot ask from 2026-08-09 is the founding promise of this milestone and closes here.

### D-08 (Wave decomposition preview — for planner)

Preview only. `/gsd:plan-phase` refines.

- **Wave 1** — adapter build (browser.ts adapter rendering + popover + icon states + portal positioning + keyboard) + new icon glyph (`icons-payload.ts`). Single plan; complex; isolated to viewmodel-shell/src/.
- **Wave 2** — demo migration (7 files across TS + .NET, plus test updates). Could split into TS-side plan + .NET-side plan if size warrants. Depends on Wave 1.
- **Wave 3** — parallel: TUI comment-out + follow-up bounty (small); adapter tests (`test/filter-adapter.test.ts`); docs (MIGRATION.md + AGENTS.md new-primitive section + CHANGELOG version header). Each ~1 plan.
- **Wave 4** — verification page (served, real bundle) → Ashley's real-browser exercise → release ritual (version bumps + publish + tag + advance main + Markdown companion republish + Poppy DM + `#vms-announcements` announce). Human-gated at the exercise step (real gate, not theatrical).

Expected plan count: 5-7. Wave-1 the heaviest; Wave-4 the ritual-heavy.

**Removal-timing note (planner MUST decide sequence):** The 8 old wire fields removal (REQ-CF2-07) can land in Wave 1 (before demos are migrated → temporarily breaks demo compile), OR in Wave 2 as the first task of the migration wave (demos migrate then old fields removed, keeping compile green throughout), OR in a dedicated late wave (demos migrated to new shape first while still declaring old fields, then old fields removed after all consumers are off them). **Recommended sequencing: Wave 2 handles migration + removal together** — each demo file's migration commit is atomic-with the removal of the specific fields it was using, so the tree is never simultaneously "demos on new wire, old wire still in framework" or "old wire removed, demos still on old wire." Planner locks the exact order.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements
- `.planning/phases/33-column-filter-expansion-phase-2-adapter-ui-popover-slash-thr/33-SPEC.md` — **Locked requirements — MUST read before planning.** 14 falsifiable requirements + boundaries + acceptance criteria (22 checkboxes). Every REQ has Current / Target / Acceptance.

### Design docs (shape + plan)
- `.planning/design/shape-column-filter-expansion.md` — locked design shape from two rounds of served tastings with Ashley (2026-08-09, 2026-08-18). Round 2 hybrid is what Phase 33 implements. Sections: "Scope edges" (In / Out (v1) / Tempting but no / Deferred), "Vehicle notes" (why phases; rough phase decomposition — this is Phase 2).
- `.planning/design/plan-column-filter-expansion.md` — milestone plan. "Phase 2 — deliverables" section (line ~83) enumerates every adapter change, framework default, migration item, in-process test, docs+release item. "Cross-phase considerations" flags Poppy pilot + verification-page discipline + icon-glyph pattern (Phase 30 `square` precedent).

### Prior phase artifacts (Phase 32 — the additive foundation this phase completes)
- `.planning/phases/32-column-filter-expansion-phase-1-wire-types-reference-truth-f/32-SPEC.md` — 8 requirements from Phase 1 (the wire additions + truth function).
- `.planning/phases/32-column-filter-expansion-phase-1-wire-types-reference-truth-f/32-CONTEXT.md` — Phase 1 implementation decisions. D-01 (wire shape split), D-03 (date operators format-agnostic, all 4 ISO shapes), D-04 (no framework machinery for override seam), D-05 (file locations) all apply to Phase 33 wiring.
- `.planning/phases/32-column-filter-expansion-phase-1-wire-types-reference-truth-f/32-01-SUMMARY.md` through `32-04-SUMMARY.md` — what actually landed (162 TS + 126 .NET NASA cases; 101-case parity fixture; matchesFilter + FilterHelper.MatchesFilter exports; mutation-verify documented).
- `.planning/phases/32-column-filter-expansion-phase-1-wire-types-reference-truth-f/VERIFICATION.md` — all 8 REQ-CF1-* PASS verdict; additive-only contract verified.

### VMS framework rules (from repo root)
- `AGENTS.md` "Critical gotchas (read first)":
  - Gotcha #8 (JSON null-omission on .NET nullable wire fields — every new nullable field carries `[JsonIgnore(WhenWritingNull)]`; every optional non-nullable bool whose `false` means absent carries `WhenWritingDefault`).
  - Gotcha #9 (parity harness is only half the gate — `findNulls` + `expectBodyContains` per-response invariants; and the load-bearing "on any VMS core MAJOR bump, every companion NuGet is rebuilt + republished with a bumped floor dep" rule — Markdown 0.2.3 in the same release session).
  - Gotcha #13 (NEVER import server bundle in browser page — verification page's in-page reducer must inline any needed helpers).
  - Gotcha #14 (CSS Containment — `container-type` element cannot be restyled by its own container-query rules — only descendants can; relevant if popover positioning composes container queries).
- `AGENTS.md` "Working agreement for agents":
  - **NEVER PUBLISH OR PUSH ANYTHING BROKEN** — full 11-command green-tree gate; pre-existing failures are NOT exceptions.
  - Git is operator-driven, not autonomous (but maintainer-role has standing "finish = commit + push + publish" authorization).
- `AGENTS.md` "Conventions for evolving the framework":
  - `## Unreleased` promotion + `CHANGELOG.md` + `MIGRATION.md` are release-gated; every version bump gets a matching CHANGELOG entry.
  - Publishing runbook — `NPM_TOKEN` + `NUGET_API_KEY` in gitignored `.env`; never `npm login`; `git tag -a v<version>` after publish; **`git merge-base --is-ancestor v<version> main`** verification (the 1.5.0/1.6.0 stranded-tag lesson).
  - Green-tree gate = 11 commands including `check:test-types`, `check:demo-types`, `check:core-globals`, `check:no-demo-style`, parity, every `demo/**/*.Tests.csproj`.
- `AGENTS.md` "Verification workflow for consumer-facing changes":
  - Real-browser exercise is a HARD gate (2026-08-06 standing directive) — headless-chrome iteration is encouraged but never substitutes for Ashley's exercise.
  - Real-bundle + shipped-CSS + in-page-reducer for interactive verification pages (per adapter test).
  - Iframes required for A/B/wider comparisons on the same page (2026-07-30 lesson — shared parent-page `<script>`/`<link>` defeats the comparison).
- `AGENTS.md` "A 'known v1 limitation' that fires on FIRST USE is a defect ratified in prose" (banked 2026-07-23) — directly applies to popover viewport-edge clipping. Fix before ship; do NOT caveat in CHANGELOG.

### Prior phase pattern precedent
- `.planning/phases/30-chat-composer-primitive-chatcomposernode-route-b-composite/` — Phase 30 shipped the `square` icon glyph as a single new addition to `icons-payload.ts`; direct precedent for `filter-slash` glyph addition.
- `.planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/` — Phase 28's `RichTextFieldNode` was an adapter-heavy phase with editor instances on `BrowserAdapter` (`editorInstances` Map); precedent for D-01's client-only-adapter-owned pattern.

### Repo entry points touched by this phase
- `viewmodel-shell/src/browser.ts` — adapter rendering; popover render + mount; portal element; positioning logic; icon-state emission; draft-Map field on BrowserAdapter class. Filter row rendering currently at `browser.ts:5691-5724` (old wire).
- `viewmodel-shell/src/icons-payload.ts` — new `filter-slash` glyph.
- `viewmodel-shell/src/index.ts` — remove 4 old TS wire fields (`filterable`, `filterValue`, `filterBinds`, `filterAction`).
- `viewmodel-shell-dotnet/ViewModels.cs` — remove 4 old .NET wire fields (`Filterable`, `FilterValue`, `FilterBinds`, `FilterAction`).
- `viewmodel-shell/src/tui.tsx:1390-1395` — comment-out old-wire filter row block; follow-up bounty pointer.
- `viewmodel-shell/test/filter-adapter.test.ts` (NEW) — VMS blind-drive adapter tests.
- `viewmodel-shell/styles/default.css` — popover styling (border, padding, z-index, radius); inline-input read-only-summary styling (italic muted).
- `demo/Showcase/frontend/src/main.ts` — migrate 2 filter columns.
- `demo/HelpDesk-bun/server.ts` — migrate filter columns + action handler.
- `demo/HelpDesk/AspNetCore/AgentController.cs` — migrate filter columns + action handler; MIGRATION.md reference source.
- `demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs` — update tests to new wire.
- `demo/ExpenseTracker/AspNetCore.Tests/ExpensesControllerTests.cs` — update tests to new wire.
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — migrate filter columns + action handler.
- `demo/FeatureProbe-bun/handler.ts` — migrate filter columns + action handler.
- `MIGRATION.md` (repo root) — new section for v10.0.0 wire replacement.
- `AGENTS.md` (repo root) — new section describing the typed column-filter primitive.
- `CHANGELOG.md` (repo root) — promote `## Unreleased` → `## 10.0.0 — <date>` header with Phase 33 additions layered on top of Phase 32's staged content.
- `viewmodel-shell/package.json` — version bump to 10.0.0.
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` — `<Version>10.0.0</Version>`.
- `viewmodel-shell-dotnet/Markdown/AshleyShrok.ViewModelShell.Markdown.csproj` — `<Version>0.2.3</Version>` + `<PackageReference>` floor dep bumped to `10.0.0`.

### Reference bounty
- `~/.claude/roles/vms-maintainer/bounties/table-column-filter-expansion/bounty.json` — full session-by-session history of how the milestone got here (Poppy DM 2026-08-09 → 3-population recon → 2 tasting rounds → shape+plan greenlit 2026-08-18 → Phase 32 planned+executed 2026-08-18). Recon reports also in that folder.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Client-only adapter state Maps** — `BrowserAdapter` already holds 8+ instance Maps for transient UI state (`fileRegistry`, `detailsOpenSnapshot`, `sectionKeyCounter`, `chartInstances`, `editorInstances`, `liveRegions`, `lookupOpenSnapshot`, `chartKeyCounter`). The Phase 33 draft-descriptor Map fits exactly this pattern (see `browser.ts:67-221`).
- **Portal-style DOM insertion** — the existing `ChartInstances` renders `<canvas>` into `chartInstances` Map values and mutates those on data change; `LiveRegions` inserts ARIA live regions outside the tree. The mechanism for keeping a Map keyed by a stable identifier + inserting/removing DOM nodes is well-worn.
- **Icon-payload SVG conventions** — `viewmodel-shell/src/icons-payload.ts` is where the new `filter-slash` glyph lands. Phase 30's `square` glyph is the freshest single-glyph addition precedent.
- **Framework overlay convention** — `ModalNode` rendering in `browser.ts` is the closest overlay precedent (backdrop-less; portal to document.body-adjacent; no CSS enter/exit animations). The popover follows the same aesthetic but with anchor-relative positioning instead of viewport-centered.
- **jsdom + BrowserAdapter test pattern** — `viewmodel-shell/src/adapter.test.ts` + `test/*.test.ts` already exercise the adapter under jsdom with synthesized action responses. `test/filter-adapter.test.ts` inherits the pattern.
- **Fake `getBoundingClientRect()` in jsdom** — jsdom returns `{top:0, left:0, ...}` by default; tests can monkey-patch element rects for positioning assertions (existing tests do this for the chart canvas sizing).

### Established Patterns

- **`[JsonIgnore(WhenWritingNull)]` on every nullable .NET wire field** — gotcha #8. Phase 33's field REMOVALS don't add nullables, but the demo migration writes NEW state records that carry nullable Filter fields per the demo pattern.
- **Closed unions enforced TS-side only** — the operator vocabularies from Phase 32 are closed on TS; .NET twins are typed `string`. Adapter reads TS union values; no runtime validation at the boundary.
- **`## Unreleased` promotion** — the CHANGELOG's current `## Unreleased` section (containing Phase 32's additive-wire staging entry) gets promoted into `## 10.0.0 — <date>` alongside Phase 33's own additions. The Phase 32 entry stays; Phase 33 appends its own bullets under the same version header.
- **Aligned major bump + companion rebuild** — Markdown 0.2.1 rebuild after 8.0.0 is the precedent for Markdown 0.2.3 rebuild after 10.0.0; verify with `curl` to the flat-container registry endpoint.
- **In-page reducer for interactive verification pages** — established pattern per AGENTS.md "How to build the run-through page" (real bundle + real CSS + fake fetch + port `buildVm` + action handling to inline JS). Phase 33 verification page follows this.

### Integration Points

- **Adapter integrates at `browser.ts` table rendering.** Filter row rendering currently at `browser.ts:5691-5724` (`n.columns.some(c => c.filterable)` gate → per-column input rendering → filterAction dispatch). Phase 33 replaces this block with the always-visible-input + filter-button + popover rendering.
- **Draft Map integrates at `BrowserAdapter` class.** New private field `private filterDrafts = new Map<string, DraftFilterDescriptor>()` (or similar); key by column bind path.
- **Portal integrates at `BrowserAdapter` constructor.** After `container.replaceChildren(...)` (or wherever the constructor sets up), append `this.popoverPortal = document.createElement("div"); this.popoverPortal.className = "vms-popover-portal"; container.appendChild(this.popoverPortal);`.
- **Icon-state emission integrates at filter-row rendering.** The three states (slash / plain / plain+dot) computed from the descriptor at the bind path; corresponding icon glyph or class attached to the filter button.
- **CSS integrates at `viewmodel-shell/styles/default.css`.** New rules: `.vms-popover-portal` (position + z-index), `.vms-filter-popover` (border + padding + background + shadow + radius), `.vms-filter-inline-summary` (italic + muted), `.vms-filter-button` (button + icon + focus state).
- **Consumer action handlers integrate at each demo's controller/handler.** Replace bespoke filter-value loops with `matchesFilter(descriptor, cell, cellDisplay, kind)` / `FilterHelper.MatchesFilter(...)` per row × per column.
- **CI integrates at `.github/workflows/parity.yml`.** All 11 gate commands run on release commit; verify green before publish.

</code_context>

<specifics>
## Specific Ideas

- **Ashley's Q1 answer (2026-08-18):** "We are not going to do the terminal adapter update" — TUI is out of scope for this phase; comment-out the filter row block; follow-up bounty captures the refresh.
- **Ashley's Q2 answer:** `filter-slash` (not `filter-off`) — matches the shape doc's "slash-through funnel" language.
- **Ashley's Q3-Q5 answers:** all-recommended (Markdown companion rebuild in-scope; all 7 demo files migrate this phase; 3-table verification page).
- **Ashley's Round 1 answer (2026-08-18):** all 6 discuss-phase gray-area recommendations accepted (D-01 through D-06 above).
- **Round 2 hybrid tasting is still served on `http://100.113.23.63:8091/`** — reference during execution. The hybrid design there IS what Phase 33 builds.
- **Poppy is the pilot.** Her PBMInvoices migrates on the same release. DM order per D-07.
- **v10.0.0 aligns npm + NuGet at the major boundary** — the 9.2.1 npm-only wheel-fix asymmetry resolves.
- **Popover viewport-edge clipping is a first-use ship-blocker** per Ashley's banked tooltip lesson (2026-07-23). Verify against a table near viewport edge on the served verification page. Not a "known limitation" — a defect if it fires.

</specifics>

<deferred>
## Deferred Ideas

### For a follow-up phase (captured in bounty)
- **TUI filter-row refresh to the new wire shape** — `~/.claude/roles/vms-maintainer/bounties/tui-filter-refresh/bounty.json` (to be created as part of REQ-CF2-09). Minimum refresh only: read `[filter]` / `[value]` labels from `filterDescriptorBinds` state path instead of old `filterable`/`filterValue`; NO popover, NO icon states, NO type-picker. TUI stays `@experimental`.

### For future / on signal (per shape doc "Deferred")
- **Global "search everything" quick-filter box** — separate from per-column filters.
- **Chip strip below the table** showing active filters as removable pills.
- **More matching hints beyond `ignore-punctuation`** — case-sensitive opt-in, ignore-whitespace, ignore-diacritics.
- **Cross-column filter combining** (`col A matches X OR col B matches Y`).
- **Nested filter groups** (`(A AND B) OR (C AND D)`).
- **Multi-value operators** (`is any of` / `is none of` — currently expressed via AND/OR of `is` rules).
- **Auto-inferring column type from cell content** (shape doc "Tempting but no").
- **Auto-populating fixed-set options from row data** (shape doc "Tempting but no").
- **Custom-operator registration by apps** (shape doc "Tempting but no").
- **Free-form filter expression language** (shape doc "Tempting but no").

</deferred>

---

*Phase: 33-column-filter-expansion-phase-2-adapter-ui-popover-slash-thr*
*Context gathered: 2026-08-18*
