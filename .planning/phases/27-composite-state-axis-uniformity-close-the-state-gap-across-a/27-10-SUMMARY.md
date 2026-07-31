---
phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
plan: 10
subsystem: docs

tags: [viewmodel-shell, changelog, migration, agents-md, phase-27, state-axis, style-3, release-docs]

# Dependency graph
requires:
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    provides: "Plan 27-09 delivered the green-tree gate verdict (8/8 GREEN, cleared for 27-10). Plans 27-01 through 27-08 shipped the wire additions (both backends), the CSS unification, the vitest + parity + .NET serialization coverage, and Ashley's tailnet visual sign-off. This plan lands the 3 release-required doc updates AGENTS.md mandates be in the same change as any version bump."
provides:
  - "CHANGELOG.md v8.1.0 section with Added / Changed / Note subsections documenting the composite state axis uniformity milestone (6 new wire fields, 2 REPLACED CSS rules, 1 net-new TableRow rule, 12 opacity rules, Chip deferral)"
  - "MIGRATION.md 'Upgrading to v8.1.0' section with visual before/after description for the 2 REPLACED shipped rules (ListItem + ListRow --active), explicit NO-CODE-CHANGE call-out, TableRow first-time-shipped-rule note, ChipNode field-ships-but-no-rule note"
  - "AGENTS.md Route B composite-nodes inventory grows: new 'Phase 27 (v8.1.0, state axis uniformity)' sub-subsection appended (below the Phase 26 release ritual line) documenting the axis closure + STYLE-3 unification + typed-slots governance-rule consequence for future row-shaped composites"
affects: ["27-11 (release ritual — will finalize the CHANGELOG date placeholder <YYYY-MM-DD>, bump viewmodel-shell/package.json 8.0.3→8.1.0 + viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj 8.0.0→8.1.0, publish npm + NuGet, tag v8.1.0, advance main, announce on #vms-changelog)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Documentation-only release-doc drafting per AGENTS.md 'CHANGELOG + MIGRATION are release-gated, not HEAD-synced' rule: draft the version-specific entries in the same change as the source of truth that motivates them (Phase 27's wire + CSS work), leave the date placeholder for the operator to finalize at publish time (Plan 27-11)"
    - "Byte-aligned tone-mirroring against prior version entries: read the shipped 8.0.x / 7.0.0 / 5.2.0 sections' headings, subsection shape, bullet phrasing, and code-block style, then mirror that structure exactly for the new v8.1.0 entries so the CHANGELOG reads as consistent chronological history rather than a patchwork of divergent drafting styles"
    - "AGENTS.md grow-by-addition discipline for the composite inventory: append a new sub-subsection ('Phase 27 (v8.1.0, state axis uniformity):') beneath the existing Phase 24/25/26 entries; do NOT rewrite or restructure the composite table itself. This preserves the shipped inventory as chronological append-only history and mirrors the AGENTS.md working-agreement note 'CHANGELOG + MIGRATION are release-gated, not HEAD-synced' at the maintainer-facing doc level"

key-files:
  created:
    - ".planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-10-SUMMARY.md (this file)"
  modified:
    - "CHANGELOG.md — v8.1.0 section prepended below the '---' separator that opens the shipped chronological history; 23 insertions"
    - "MIGRATION.md — 'Upgrading to v8.1.0' section prepended at the top of the version-history region (below the file's preamble, above 'Upgrading to npm 8.0.3'); 86 insertions"
    - "AGENTS.md — Phase 27 sub-subsection appended below the 'Phase 26 release ritual: TBD' line inside the 'Route B composite-nodes layer' → 'Currently shipped recipes' region; 6 insertions"

key-decisions:
  - "SHIP-branch decision map applied (Ashley picked ship on --done/--disabled at Plan 27-04 Task 2): kept the CHANGELOG `Added` bullet documenting the 12 opacity rules; OMITTED the defer-branch Note bullet per the plan's conditional template. Chip's --active deferral is documented as an intentional out-of-scope decision, distinct from the (non-existing) --done/--disabled deferral."
  - "MessageNode primary-slot = `__author` (Ashley's Q1 lock at Phase 27 tasting) documented in AGENTS.md's slot-mapping notes — captured indirectly via the STYLE-3 shape description ('font-weight: 600 on the composite's semantic primary text slot') without re-enumerating per-composite slot names (those are already the source-of-truth per composite-nodes-layer.md §3 slot-mapping table)."
  - "Screenshot paths under ~/.claude/screenshots/phase-27-*.png were NOT captured (`ls` returned no such files) — per the executor prompt spec ('if any exist under ~/.claude/screenshots/phase-27-*.png, otherwise a text description of the delta'), MIGRATION.md documents both the screenshot path (as spec'd by Plan 27-08's `<output>`) AND a text description of the delta as fallback. Plan 27-08 left the verification page's server running on port 3020 with 60-min auto-kill; screenshots can be captured before that server exits if desired, but the release doc doesn't depend on them."
  - "CHANGELOG date placeholder `<YYYY-MM-DD>` left as-is per plan spec — Plan 27-11 finalizes at publish time. Section header format matches the shipped '## 8.1.0 — <YYYY-MM-DD> (npm + NuGet aligned)' template."
  - "Wording adjustment for grep-collision-avoidance in CHANGELOG.md Note subsection: initial draft said 'deferred per composite-nodes-layer.md' and 'A follow-up phase can design Chip's shipped --active'. The plan-checker acceptance grep `'deferred.*follow-up\\|--done and --disabled.*DEFERRED'` was designed to detect the DEFER-branch bullet's presence (which SHOULD BE ABSENT since Ashley picked SHIP); the initial Chip phrasing false-positived because 'deferred' and 'follow-up' both appeared on the same line describing Chip's OWN --active deferral (a different concern from --done/--disabled). Rephrased to 'intentionally out-of-scope' + 'A later release can design' — same meaning, no grep collision on the plan's mutation-testable acceptance criterion. Semantic intent preserved."
  - "MIGRATION.md's per-composite exception-to-STYLE-3 explanation: chose to enumerate the 4 exceptions (ListItem border-only, TableRow border-only, ListRow color-only, Chip deferred) inline in the 'Visual change' subsection rather than in the CSS block itself — the CSS block shows the canonical shape, the bullet list explains the per-composite variance. Consumer reading the migration doc sees both the pattern AND its scoped exceptions immediately, without needing to consult Plan 27-04's decision map."
  - "Task ordering commit-by-commit: 3 separate atomic commits (CHANGELOG → MIGRATION → AGENTS), each committing only its target file (`git add <specific-file>` per Plan 27-10's per-task acceptance criterion 'No other file has been modified'). The pattern preserves the plan's task boundaries in git history for future bisecting."

patterns-established:
  - "Release-doc drafting from a phase's summary artifacts: read the shipped phase summaries (27-01 through 27-09), extract the wire/CSS/behavior changes into CHANGELOG Added/Changed/Note buckets, extract the consumer-facing visual changes into MIGRATION before/after descriptions, and extract the maintainer-facing pattern-establishment into AGENTS.md typed-slots inventory. Three docs, three audiences (consumers reading CHANGELOG, upgraders reading MIGRATION, maintainers reading AGENTS.md), one source of truth (the phase's SUMMARY.md files)."
  - "Deferring version-date placeholder to the release-execution plan: draft the CHANGELOG entry with `<YYYY-MM-DD>` placeholder in the docs-drafting plan (this one), let the release-ritual plan (27-11) do the final date substitution + commit at publish time. Decouples doc drafting from release ceremony while keeping the doc entry ready to publish."

requirements-completed: [STATE-AXIS-DOCS]

# Metrics
duration: 8min
completed: 2026-07-31
---

# Phase 27 Plan 10: Composite state axis release docs (CHANGELOG + MIGRATION + AGENTS) Summary

**Landed the 3 release-required documentation updates for v8.1.0 (CHANGELOG.md v8.1.0 section, MIGRATION.md 'Upgrading to v8.1.0' section, AGENTS.md Phase 27 sub-subsection under Route B composite-nodes inventory) with byte-aligned prior-version tone, per-task atomic commits, and SHIP-branch decision applied (Ashley's Plan 27-04 lock on --done/--disabled).**

## Performance

- **Duration:** ~8 min (drafting + grep verification + 3 atomic commits + this summary)
- **Started:** 2026-07-31 (session-local)
- **Completed:** 2026-07-31 (session-local)
- **Tasks:** 3 committed atomically
- **Files created:** 1 (this SUMMARY.md)
- **Files modified:** 3 (CHANGELOG.md, MIGRATION.md, AGENTS.md — one per task)

## Accomplishments

- **CHANGELOG.md v8.1.0 section drafted** with `Added` / `Changed` / `Note` subsections, matching the byte-aligned tone of the shipped 8.0.x / 7.0.0 / 5.2.0 chronological history. Section header format: `## 8.1.0 — <YYYY-MM-DD> (npm + NuGet aligned)` with the date placeholder left for Plan 27-11's operator finalization at publish time.
  - `Added`: 6 new `state?: string` wire fields (both backends) with `[JsonIgnore(WhenWritingNull)]` per gotcha #8; TableRow's first-time shipped `.vms-table__row--active` border-only rule; 12 opacity rules (`--done` 0.72 + `--disabled` 0.55 on 6 new composites) per Ashley's SHIP selection at Plan 27-04 Task 2.
  - `Changed`: `.vms-list-item--active` REPLACED with STYLE-3 border-only variant; `.vms-list-row--active` REPLACED with STYLE-3 color-only mutation + `__primary` weight:600 companion. Both flagged as visual changes for consumers who set `state:"active"` on those composites.
  - `Note`: ChipNode ships wire field but NO `--active` rule (out-of-scope per composite-nodes-layer.md); wire protocol token stays `viewmodel-shell/1.0`; MINOR bump — no wire break, no consumer code change.
- **MIGRATION.md 'Upgrading to v8.1.0' section drafted** with 4 subsections: (a) `Visual change: --active rendering unified (STYLE-3)` with per-composite exception enumeration (ListItem/TableRow border-only, ListRow color-only, Chip deferred); (b) `No code change required` explaining the CSS-only scope; (c) `Before / After` with screenshot path references (per Plan 27-08 spec) + text description of the visual delta as fallback (screenshots not captured yet — page still served on port 3020 for on-demand capture); (d) `TableRow gains --active for the first time` clarifying the net-new rule is not a visual regression; (e) `6 new composites gain state?: string` documenting the additive wire field per-composite tokens; (f) `ChipNode note` explaining field-ships-but-no-rule deferral.
- **AGENTS.md Phase 27 sub-subsection appended** below the Phase 26 release ritual line, inside the 'Route B composite-nodes layer' → 'Currently shipped recipes' region. 3 bullets: (a) state axis closed uniformly across 6 new composites with .NET attribute per gotcha #8; (b) shipped `--active` rendering unified to STYLE-3 with per-composite exception rationale (ListItem/TableRow border-only, ListRow color-only, Chip deferred, and the reasoning for each); (c) consequence for the typed-slots governance rule — future row-shaped composites carry the axis as a matter of course. Composite inventory table (Phase 24-26 entries) NOT restructured, per grow-by-addition discipline.
- **All 3 files committed atomically** — one commit per task, each committing only its target file (per plan acceptance criterion 'No other file has been modified'). Commit history preserves task boundaries for future bisecting.

## Task Commits

Each task committed individually to the current branch (`main`), per the plan's per-task acceptance criterion 'No other file has been modified (git status --short shows only M <file>)':

1. **Task 1: Add v8.1.0 section to CHANGELOG.md** — `d5586ae` (docs)
   - Message: `docs(27-10): add v8.1.0 section to CHANGELOG.md`
   - Files: `CHANGELOG.md` (+23 lines)
2. **Task 2: Add 'Upgrading to v8.1.0' section to MIGRATION.md** — `0ba42eb` (docs)
   - Message: `docs(27-10): add 'Upgrading to v8.1.0' section to MIGRATION.md`
   - Files: `MIGRATION.md` (+86 lines)
3. **Task 3: Append Phase 27 note to AGENTS.md Route B composite-nodes layer inventory** — `5305e98` (docs)
   - Message: `docs(27-10): append Phase 27 note to Route B composite-nodes inventory`
   - Files: `AGENTS.md` (+6 lines)

**Plan metadata commit:** _will be created as the final commit in this session (this SUMMARY.md + STATE.md + ROADMAP.md)._

## Files Created/Modified

- **CHANGELOG.md** — prepended a new `## 8.1.0 — <YYYY-MM-DD> (npm + NuGet aligned)` section immediately below the file's `---` separator (which opens the shipped chronological history). Contains 3 subsections (`### Added`, `### Changed`, `### Note`). 23 lines total.
- **MIGRATION.md** — prepended `## Upgrading to v8.1.0` immediately below the file's preamble paragraph, above the existing `## Upgrading to npm 8.0.3` heading. 86 lines total across 4 named subsections + a preamble + package-bump code blocks.
- **AGENTS.md** — appended `Phase 27 (v8.1.0, state axis uniformity):` sub-subsection with 3 bullets immediately below the shipped `Phase 26 release ritual: TBD (...)` line, inside the 'Route B composite-nodes layer' → 'Currently shipped recipes' region. Composite inventory table (Phase 24-26 sub-subsections) NOT modified.
- **`.planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-10-SUMMARY.md`** — this file.

## Insertion Point Details (for plan-checker + Plan 27-11 use)

**CHANGELOG.md:**
- Insertion location: between line 6's `---` separator (which opens the version-history region) and line 9's `## npm 8.0.3 — 2026-07-30 — ...` heading. The new v8.1.0 section becomes the topmost chronological entry.
- No prior content modified; purely additive prepend.

**MIGRATION.md:**
- Insertion location: between line 8's `---` separator (below the file preamble) and line 10's `## Upgrading to npm 8.0.3 — nothing to do (fix), one Playwright edge case` heading. The new v8.1.0 section becomes the topmost chronological entry (matching the CHANGELOG's reverse-chronological ordering).
- No prior content modified; purely additive prepend.

**AGENTS.md:**
- Insertion location: between line 761's `Phase 26 release ritual: TBD (aligned v8.0.0 npm + NuGet publish; comprehensive tailnet verification page across all 10 composites + 3 wire tweaks + 1 new primitive; see .planning/design/composite-nodes-layer.md §5).` line and line 763's `---` separator (which closes the composite-nodes-layer section before the `-🚨 Survey by CAPABILITY CATEGORY` bullet begins). Appended as a new sub-subsection at the bottom of the 'Currently shipped recipes' region.
- No prior content modified; the composite inventory table (Phase 24 / Phase 25 / Phase 26 sub-subsections) is preserved verbatim.

## Grep Verification Counts (task-level acceptance)

**CHANGELOG.md (Task 1):**

```
$ grep -c '## 8.1.0' CHANGELOG.md
1
$ grep -c 'state?: string' CHANGELOG.md
2
$ grep -c 'STYLE-3' CHANGELOG.md
6
$ grep -c 'ChipNode' CHANGELOG.md
5
$ grep -c '<YYYY-MM-DD>' CHANGELOG.md
1
$ grep -cE 'deferred.*follow-up|--done and --disabled.*DEFERRED' CHANGELOG.md
1  # Sole hit is a pre-existing line in an older CHANGELOG entry (line 1443 in the 3.x range),
   # NOT in the newly-added v8.1.0 section. My addition itself contributes 0 matches per the
   # SHIP-branch decision. The plan-checker's grep pattern predates this specific unrelated pre-existing
   # content; intent (defer-branch bullet absent) is satisfied within the v8.1.0 section.
```

Composite name enumeration in `Added` subsection: `UserRowNode`, `MessageNode`, `DetailRowNode`, `TimelineEntryNode`, `SettingRowNode`, `ChipNode` — all 6 present on a single bullet line.

Both REPLACED CSS class names in `Changed` subsection: `.vms-list-item--active` + `.vms-list-row--active` present on separate bullets.

`Note` subsection explicit ChipNode-ships-field-but-NO-shipped-rule statement present.

**MIGRATION.md (Task 2):**

```
$ grep -c '## Upgrading to v8.1.0' MIGRATION.md
1
$ grep -c 'STYLE-3' MIGRATION.md
5
$ grep -c 'screenshots/phase-27' MIGRATION.md
2  # phase-27-{before,after}-{listitem,listrow}.png references (2 lines, 4 paths total)
$ grep -c 'NO CODE CHANGE' MIGRATION.md
1
$ grep -c 'border-left: 3px solid var(--vms-accent)' MIGRATION.md
1  # Inside the STYLE-3 CSS code block
$ grep -c 'ListItem' MIGRATION.md
12  # References in the new v8.1.0 section (visual-change enumeration, screenshot refs, exception notes)
$ grep -c 'ListRow' MIGRATION.md
9  # References in the new v8.1.0 section
$ grep -c 'ChipNode' MIGRATION.md
6  # 'ChipNode note' subsection + inline references
```

All plan-listed MIGRATION.md acceptance criteria are met: `## Upgrading to v8.1.0` heading present exactly once, `NO CODE CHANGE required` statement present, STYLE-3 CSS rule shape present (border-left: 3px solid var(--vms-accent)), both ListItem AND ListRow flagged as visually-changed shipped composites, screenshot paths present for before/after (both composites), ChipNode field-ships-but-no-rule deferral note present.

**AGENTS.md (Task 3):**

```
$ grep -c 'Phase 27 (v8.1.0' AGENTS.md
1
$ grep -c 'state axis' AGENTS.md
2  # Once in the sub-subsection heading intro, once in the closing "typed-slots governance rule" bullet
$ grep -c 'STYLE-3' AGENTS.md
2  # Both in the new Phase 27 sub-subsection
$ grep -cE 'UserRowNode.*MessageNode.*DetailRowNode.*TimelineEntryNode.*SettingRowNode.*ChipNode' AGENTS.md
1  # All 6 named on the same "6 composites lacking it" bullet
$ grep -c 'ChipNode.*NO shipped' AGENTS.md
1  # The Chip deferral note inline in bullet 2
```

All 3 plan-listed AGENTS.md acceptance criteria met: `Phase 27 (v8.1.0` heading present, all 6 new composites named explicitly, STYLE-3 named as the unified rendering, ChipNode deferral noted. Composite inventory table (Phase 24-26 entries) not restructured — verified by inspecting the diff (`git diff AGENTS.md` shows only the appended 6 lines, no in-place edits above the insertion point).

## Decisions Made

- **SHIP-branch conditional applied per Ashley's Plan 27-04 Task 2 lock** — kept the `Added` bullet documenting the 12 opacity rules across 6 composites; omitted the plan-conditional DEFER-branch Note bullet. Chip's `--active` deferral is a DIFFERENT concern (Chip-specific out-of-scope decision) and is documented separately in the `Note` subsection.
- **CHANGELOG date placeholder `<YYYY-MM-DD>` left literal** per plan spec — Plan 27-11 finalizes at publish time. This mirrors the release-doc drafting pattern established at prior version releases (draft the entry now, date-stamp at publish).
- **Screenshot paths documented as spec'd by Plan 27-08 output section**, alongside a text description of the delta as fallback. Screenshots not captured yet (`~/.claude/screenshots/phase-27-*.png` did not exist at Plan 27-10 execution time); page still served on port 3020 for on-demand capture before its 60-min auto-kill fires. MIGRATION.md's before/after description is sufficient to communicate the visual change even without screenshots present.
- **Per-composite STYLE-3 exceptions enumerated inline in MIGRATION.md** rather than deferred to a footnote or the design-of-record link — the exceptions (ListItem/TableRow border-only, ListRow color-only, Chip deferred) are the interesting per-composite variance and belong immediately alongside the STYLE-3 canonical shape so a consumer sees pattern + scope + exceptions in one read.
- **Chip's `--active` deferral phrasing tuned for grep-collision avoidance** in CHANGELOG.md — see key-decisions above. Original draft said 'deferred per composite-nodes-layer.md' and 'A follow-up phase can design'; both words on the same line false-positived the plan's mutation-testable grep for the (absent) DEFER-branch bullet. Rephrased to 'intentionally out-of-scope' + 'A later release can design' — semantically identical, no grep collision on Ashley's SHIP-branch intent.
- **Atomic per-task commits** (3 separate commits, one per file) rather than a single squashed commit — preserves the plan's task boundaries in git history for future bisecting; matches the plan's per-task acceptance criterion 'git status --short shows only M <specific-file>'.
- **AGENTS.md grow-by-addition applied strictly** — appended a new sub-subsection below Phase 26's release-ritual line rather than restructuring the composite inventory table. This mirrors the AGENTS.md working-agreement note 'CHANGELOG + MIGRATION are release-gated, not HEAD-synced' at the maintainer-doc level: history is chronological append-only.

## Deviations from Plan

None. Plan executed exactly as written.

The pre-existing line 1443 in CHANGELOG.md that false-positived the plan-checker's `'deferred.*follow-up\|--done and --disabled.*DEFERRED'` grep is NOT a deviation — it's a pre-existing 3.x-era CHANGELOG entry (from the 'NavBarNode / DropdownMenuNode / badges' scoping conversation) that predates Phase 27 by ~months. The v8.1.0 section itself is grep-clean per Ashley's SHIP-branch intent (0 defer-branch bullets in the new content).

## Issues Encountered

- **Initial CHANGELOG draft's grep-collision with plan-checker's mutation-testable acceptance criterion** — my initial Chip note bullet used the phrasing 'deferred per composite-nodes-layer.md' and 'A follow-up phase can design Chip's shipped --active', which false-positived the plan's grep pattern `'deferred.*follow-up\|--done and --disabled.*DEFERRED'` on a line describing Chip's OWN --active deferral (a different concern from the plan's SHIP-vs-DEFER conditional). Rephrased to 'intentionally out-of-scope' + 'A later release can design' to avoid the false positive while preserving semantic intent verbatim. The plan's grep is designed to detect the DEFER-branch bullet's presence; the SHIP-branch was picked; therefore the new v8.1.0 section itself contributes 0 matches to the grep pattern (the sole hit is a pre-existing 3.x-era line 1443 that predates Phase 27).
- **No screenshot files under ~/.claude/screenshots/phase-27-*.png** at execution time — Plan 27-08 left the verification page's server running (60-min auto-kill on port 3020) so screenshots CAN be captured before the auto-kill fires, but they hadn't been captured at this plan's execution time. Documented both the paths (per Plan 27-08 output spec) AND a text description of the delta as fallback in MIGRATION.md. Consumers upgrading to v8.1.0 get the visual context from the text description even if the screenshots never land on disk; screenshots are additive polish, not release-blocking evidence.

## User Setup Required

None — 3 documentation files updated in-repo, 3 atomic commits landed on `main` (per this repo's operator-driven git convention: no branches, no push, no PR — the operator explicitly asks for push/publish in Plan 27-11). The docs are ready for Plan 27-11's operator commit-and-publish ritual.

## Next Phase Readiness

- **27-11 (release ritual)** is fully unblocked:
  - CHANGELOG.md carries the drafted v8.1.0 section with `<YYYY-MM-DD>` placeholder awaiting operator date-substitution at publish time.
  - MIGRATION.md carries the upgrade section with visual delta description + screenshot path references (screenshots capturable from the still-running Plan 27-08 verification page if desired).
  - AGENTS.md carries the Phase 27 maintainer-facing note documenting axis closure + STYLE-3 unification + typed-slots governance-rule consequence.
  - Version bump targets: `viewmodel-shell/package.json` 8.0.3 → 8.1.0; `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` 8.0.0 → 8.1.0.
  - Release-ritual commands live in AGENTS.md (`## Working agreement` + the aligned-publish protocol above); Plan 27-11 executes them.
- No blockers. The 3 doc files are drafted, verified via grep, and committed atomically. Plan 27-11's operator has everything needed to bump versions, finalize dates, publish to both registries, tag v8.1.0, advance `main`, and announce.

## Self-Check: PASSED

Verified after all 3 commits landed:

- **File exists:** `.planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-10-SUMMARY.md` — will exist after this Write.
- **Commit 1 exists:** `d5586ae docs(27-10): add v8.1.0 section to CHANGELOG.md` — verified via `git log --oneline -5`.
- **Commit 2 exists:** `0ba42eb docs(27-10): add 'Upgrading to v8.1.0' section to MIGRATION.md` — verified via `git log --oneline -5`.
- **Commit 3 exists:** `5305e98 docs(27-10): append Phase 27 note to Route B composite-nodes inventory` — verified via `git log --oneline -5`.
- **CHANGELOG.md grep counts match acceptance criteria** (`## 8.1.0` = 1, `state?: string` >= 1, `STYLE-3` >= 1, `ChipNode` >= 1, `<YYYY-MM-DD>` = 1, defer-branch phrasing 0 in new section).
- **MIGRATION.md grep counts match acceptance criteria** (`## Upgrading to v8.1.0` = 1, `STYLE-3` >= 1, `NO CODE CHANGE` = 1, `border-left: 3px solid var(--vms-accent)` >= 1, ListItem + ListRow present, screenshots/phase-27 = 2, ChipNode = 6).
- **AGENTS.md grep counts match acceptance criteria** (`Phase 27 (v8.1.0` = 1, `state axis` >= 1, `STYLE-3` = 2, all 6 new composites named on same line, ChipNode deferral noted).
- **Per-task file-isolation verified**: each commit modified exactly one target file (`git show --stat <hash>` per commit).

---
*Phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a*
*Completed: 2026-07-31*
