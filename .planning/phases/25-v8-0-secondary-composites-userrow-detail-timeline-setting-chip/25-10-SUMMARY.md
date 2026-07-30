---
phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip
plan: 10
status: complete
completed: 2026-07-30
---

# 25-10 SUMMARY — Phase 25 closeout (green-tree gate + Ashley visual sign-off)

## Green-tree gate results (Task 1)

| Gate | Result | Command | Notes |
|---|---|---|---|
| npm build | ✓ green | `cd viewmodel-shell && npm run build` | |
| check:test-types | ✓ green | `npm run check:test-types` | test tree strict-tsc clean |
| check:core-globals | ✓ green | `npm run check:core-globals` | core `src/index.ts` still zero platform globals |
| check:aa-contrast | ✓ green | `npm run check:aa-contrast` | fixed 13-pair gate (Phase 25 new pairs hand-checked separately below) |
| check:no-demo-style | ✓ green | `npm run check:no-demo-style` | apps still don't decorate |
| check:demo-types | ✓ green | `npm run check:demo-types` | Showcase Secondary Composites section strict-tsc clean; 21 demo projects |
| vitest | ✓ green | `npx vitest run` | **1250 passed / 1 skipped** across 78 files |
| .NET framework Tests | ✓ green | `dotnet test viewmodel-shell-dotnet/Tests` | **428 passed** |
| demo/**/*.Tests.csproj (all 5) | ✓ green | `for p in $(find demo -name '*.Tests.csproj'); ...` | **191 passed total**: 28 + 39 + 33 + 30 + 61 |
| parity | ✓ green | `cd parity && bun run run.ts` | all backends agree byte-identically; skill parity green |

**Special code-level checks (Task 1 acceptance criteria):**
- Timeline `::before` rail-and-dot mechanism installed: `grep -cE '\.vms-timeline::before|\.vms-timeline-entry::before' viewmodel-shell/styles/default.css` = **4** (rail + dot + variants) ✓
- Chip dispatch pattern proves posture at code level: `browser.ts:chip()` calls `on(dismissAction)` (caller-supplied), **NOT** `on({name:"dismiss"})`; inline comment names the KEY MUTATION TEST that catches any revert ✓
- SettingRow extended stopPropagation includes switch classes: `grep -c 'vms-checkbox__input\|vms-field--switch' viewmodel-shell/src/browser.ts` = **15** ✓

## Ashley's visual sign-off (Task 2)

**Signal received: "Approved."**

Showcase served at `http://100.113.23.63:8186/` (Vite dev bound to tailnet IP; port 8186 preferred slot). Ashley confirmed via live browser inspection:

1. **UserRow status dots** — 4 kinds render distinct colors (online=green / away=yellow / offline=gray / busy=red).
2. **DetailList** — label column visibly aligned; `tone:"danger"` row's value renders in shipped danger color.
3. **🚨 Timeline `::before` rail-and-dot** (the ONE genuinely new CSS mechanism in Phase 25) — vertical rail spans the container; each entry has a dot with tone-encoded border; verified across default + dark + light themes.
4. **SettingRow + CheckboxNode(variant:"switch") natural pairing** — switch renders in trailing slot vertically centered; extended stopPropagation prevents double-fire.
5. **ChipNode dismissAction end-to-end** — dismissible chip fires the caller-supplied name (e.g. `showcase-secondary-chip-remove-active`), **not** `dismiss`; `both`-slots chip's X fires the caller's dismiss name only (stopPropagation held).

## Requirement-to-artifact cross-check (COMP-09..13a — 9 requirements)

| Requirement | Wire type | Renderer | CSS | .NET twin | Parity tripwire | Tests | Demo adoption | CHANGELOG | Design-doc inventory |
|---|---|---|---|---|---|---|---|---|---|
| COMP-09 UserRowNode | `interface UserRowNode` in `src/index.ts` | `private userRow()` in `src/browser.ts` | `.vms-user-row*` + `.vms-status-dot*` in `styles/default.css` | `record UserRowNode` + `UserRowStatus` + `StatusKind` in `ViewModels.cs` | `"type":"user-row"` + `"kind":"online"` + `user-row-open-jd` in `parity/fixtures/feature-probe.json` | `test/user-row.test.ts` + `Tests/UserRowNodeSerializationTests.cs` | Showcase Secondary Composites + FeatureProbe secondaryCompositesSection | CHANGELOG.md Unreleased v8.0.0 Added | `composite-nodes-layer.md` Shipped Recipe Inventory row |
| COMP-10 DetailRowNode | `interface DetailRowNode` in `src/index.ts` | `private detailRow()` in `src/browser.ts` | `.vms-detail-row*` (dl/dt/dd grid) | `record DetailRowNode` in `ViewModels.cs` | `"type":"detail-row"` in feature-probe.json (3+ entries) | `test/detail-row.test.ts` + `Tests/DetailRowNodeSerializationTests.cs` | Showcase + FeatureProbe | CHANGELOG.md Added | inventory row |
| COMP-10a DetailListNode | `interface DetailListNode` in `src/index.ts` | `private detailList()` in `src/browser.ts` | `.vms-detail-list*` + `--vms-detail-label` CSS var (8/10/12rem) | `record DetailListNode` + `DetailLabelWidth` in `ViewModels.cs` | `"type":"detail-list"` + `"labelWidth":"lg"` in feature-probe.json | `test/detail-list.test.ts` + `Tests/DetailListNodeSerializationTests.cs` | Showcase + FeatureProbe | CHANGELOG.md Added (paired with COMP-10) | inventory row |
| COMP-11 TimelineEntryNode | `interface TimelineEntryNode` in `src/index.ts` | `private timelineEntry()` in `src/browser.ts` | `.vms-timeline-entry*` + `::before` dot with tone-encoded border | `record TimelineEntryNode` in `ViewModels.cs` | `"type":"timeline-entry"` (3+ entries) | `test/timeline.test.ts` + `Tests/TimelineEntryNodeSerializationTests.cs` | Showcase + FeatureProbe | CHANGELOG.md Added | inventory row |
| COMP-11a TimelineNode | `interface TimelineNode` in `src/index.ts` | `private timeline()` in `src/browser.ts` | 🚨 **`.vms-timeline::before` rail** + per-entry dot mechanism baked in | `record TimelineNode` in `ViewModels.cs` | `"type":"timeline"` | `test/timeline.test.ts` + `Tests/TimelineNodeSerializationTests.cs` | Showcase + FeatureProbe | CHANGELOG.md Added (paired with COMP-11; names the NEW ::before mechanism) | inventory row |
| COMP-12 SettingRowNode | `interface SettingRowNode` in `src/index.ts` | `private settingRow()` in `src/browser.ts` (with extended stopPropagation for switch classes) | `.vms-setting-row*` grid `[body \| control] = 1fr auto` | `record SettingRowNode` in `ViewModels.cs` | `"type":"setting-row"` + `setting-row-configure-digest` | `test/setting-row.test.ts` + `Tests/SettingRowNodeSerializationTests.cs` | Showcase (3+ rows exercising switch pairing) + FeatureProbe | CHANGELOG.md Added (names CheckboxNode(variant:"switch") natural pairing) | inventory row |
| COMP-12a SettingListNode | `interface SettingListNode` in `src/index.ts` | `private settingList()` in `src/browser.ts` | `.vms-setting-list*` bordered surface + per-row dividers | `record SettingListNode` in `ViewModels.cs` | `"type":"setting-list"` + `heading` | `test/setting-list.test.ts` + `Tests/SettingListNodeSerializationTests.cs` | Showcase + FeatureProbe | CHANGELOG.md Added (paired with COMP-12) | inventory row |
| COMP-13 ChipNode | `interface ChipNode` in `src/index.ts` | `private chip()` in `src/browser.ts` — `on(dismissAction)` (caller-supplied), NOT fixed name | `.vms-chip*` tinted-pill via `color-mix` | `record ChipNode` in `ViewModels.cs` | `"type":"chip"` + `"dismissAction":{` + `chip-remove-filter-active` | `test/chip.test.ts` (28 tests, incl KEY MUTATION TEST) + `Tests/ChipNodeSerializationTests.cs` | Showcase (4 chips: dismissAction-only + tone-only + action-only + both) + FeatureProbe | CHANGELOG.md Added (names DEVIATES-from-AlertNode.dismissible posture) | inventory row |
| COMP-13a ChipListNode | `interface ChipListNode` in `src/index.ts` | `private chipList()` in `src/browser.ts` | `.vms-chip-list*` flex-wrap horizontal cluster | `record ChipListNode` in `ViewModels.cs` | `"type":"chip-list"` | `test/chip-list.test.ts` + `Tests/ChipListNodeSerializationTests.cs` | Showcase + FeatureProbe | CHANGELOG.md Added (paired with COMP-13) | inventory row |

## AA-contrast hand-check aggregate

Total NEW pair-checks across Phase 25: **~221** (per-composite headers in each `*.test.ts` file document the exact matrix):

| Composite | Pairs checked | Themes | Total | Notes |
|---|---|---|---|---|
| UserRow status-dots | 4 kinds | 13 themes | 52 | shipped tone palette reuse; all pass AA-normal 4.5:1 |
| DetailRow label + tone-accent value | 5 pairs (label + 4 tones) | 13 themes | 65 | label = text-xs uppercase muted; tone-accent values pass AA |
| Timeline dot-borders + description | 4 tones + description-body | 13 themes | 52+ | dot borders are structural (2px) not text — AA-normal target for description only |
| SettingRow | 0 new (reuses Phase 23 body/muted + Phase 24 switch tokens) | — | 0 | documented reuse in `test/setting-row.test.ts` header |
| Chip tinted-pill (HIGHEST risk) | 4 tones | 13 themes | 52 | required `color-mix` deepening to clear AA on all themes; documented in Plan 25-05 header + verified live during Ashley's sign-off |

Anywhere any theme required deepening or KNOCKOUT mitigation: **Chip tinted-pill palette** used `color-mix` deepening at Plan 25-05 landing to clear AA-normal 4.5:1 across all 13 themes; no theme skipped.

## 🚨 The NEW ::before rail-and-dot CSS mechanism (Timeline) — end-to-end verification

Three-way proof:
- **(a) Code proof:** `styles/default.css` contains `.vms-timeline::before` (rail, spans container top-to-bottom) + `.vms-timeline-entry::before` (dot per entry) + 4 tone-encoded variants (`--vms-error` / `--vms-warning` / `--vms-success` / `--vms-info`). `grep -cE '\.vms-timeline::before|\.vms-timeline-entry::before' viewmodel-shell/styles/default.css` = 4 ✓
- **(b) Test proof:** `test/timeline.test.ts` asserts the class-emission contract (jsdom cannot compute pseudo-elements, but the CSS installation + class routing is verified from the DOM shape).
- **(c) Visual proof:** Ashley signed off after live browser inspection on default + dark + light themes: the rail visibly spans the container; per-entry dots render tone-encoded borders in every tested theme.

## 🚨 The ChipNode dismissAction posture — end-to-end verification

Four-way proof:
- **(a) Code proof:** `browser.ts:chip()` calls `on(dismissAction)` (caller's ActionEvent, verbatim); inline comment names the divergence from AlertNode + the KEY MUTATION TEST that catches any revert.
- **(b) Test proof:** `test/chip.test.ts` KEY MUTATION TEST asserts the caller-supplied name is dispatched (fails immediately if reverted to `{name:"dismiss"}`).
- **(c) Parity proof:** `"dismissAction":{` tripwire in `parity/fixtures/feature-probe.json` proves the ActionEvent-slot serializes as a JSON object across bun + node + .NET backends.
- **(d) Visual proof:** Ashley signed off after live browser inspection: dismissible chip fires the caller-supplied name (not `dismiss`) via dev-tools inspection; `both`-slots chip's X fires the dismiss name only (stopPropagation held).

## Design-doc + AGENTS.md + doc landing

- `.planning/design/composite-nodes-layer.md` shipped-recipe-inventory table extended to **9 composites** (Plan 25-06).
- `AGENTS.md` "Currently shipped recipes" section grown to **9 composites** (Plan 25-06).
- `CHANGELOG.md` Unreleased — v8.0.0 (in progress) gained **5 additive Added entries** (Plan 25-09).
- `MIGRATION.md` v8.0.0 section grew with additive note + Chip.dismissAction paragraph + Timeline `::before` paragraph (Plan 25-09).
- Showcase Secondary Composites section landed (Plan 25-07); exercises SettingRow + switch pairing 3+ rows.
- FeatureProbe parity extended with **15 tripwires** across all backends (Plan 25-08) — parity GREEN.

## NO release ship

Batch-then-ship **LOCKED** per CONTEXT §10. Explicitly:
- No `npm publish`.
- No `dotnet nuget push`.
- No git tag.
- No version bump: `viewmodel-shell/package.json` still **7.1.0**; `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>` still **7.0.0**.
- v8.0.0 releases at Phase 26 closeout with all 10 composites + 3 wire tweaks + 4 foundations in one aligned major.

## Ready for Phase 26

**Green light to run `/gsd:plan-phase 26`.** Phase 26 will:
- Bump `viewmodel-shell/package.json` 7.1.0 → **8.0.0** and `AshleyShrok.ViewModelShell.csproj` 7.0.0 → **8.0.0** (aligned major).
- Finalize `CHANGELOG.md` heading `Unreleased — v8.0.0 (in progress)` → `v8.0.0 — 2026-07-30` (or the actual publish date).
- Finalize `MIGRATION.md` v8.0.0 heading similarly.
- Update `agent-skill.md` if any wire vocabulary changed (verify — since Phase 25 composites emit new discriminators but no wire-shape breaks, likely just an inventory grow).
- Publish npm + NuGet per AGENTS.md publishing runbook (`.env` sync, `npm publish`, `dotnet pack` + `dotnet nuget push`, verify registry via curl).
- Tag `v8.0.0` at the release commit + push tag.
- Advance `main` to the release commit + verify `git merge-base --is-ancestor v8.0.0 main`.
- Serve comprehensive tailnet verification page across all 10 composites + 3 wire tweaks + 1 new primitive for final sign-off.
- Announce on `#vms-changelog` (new room_id `!E211RrsKCygK7Ev6uacpswousKy9JZiGEVLquJpC3cU` per Nelly's heads-up).

## Discovered follow-on (for Phase 26)

- `.planning/REQUIREMENTS.md` still marks **COMP-11, COMP-11a, COMP-13, COMP-13a** with `[ ]` — should be ticked `[x]` at Phase 25 close. Adjacent line: Phase 25 REQUIREMENTS have `[x]` for COMP-09, COMP-10, COMP-10a, COMP-12, COMP-12a already. Ticked in this SUMMARY's commit.
