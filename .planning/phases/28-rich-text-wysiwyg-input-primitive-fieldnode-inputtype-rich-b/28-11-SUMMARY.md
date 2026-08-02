---
phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
plan: 11
subsystem: docs
tags: [viewmodel-shell, rich-text, tiptap, turndown, route-b, composite, sanitizer, docs, release-staging, phase-28, v8.2.0]

# Dependency graph
requires:
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 10
    provides: The 18/18 green-tree gate at commit 3de7f2e — the precondition for release staging (no doc entry allowed on top of a broken tree). All 4 files staged in this plan are edited against that green baseline.
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 04
    provides: Ashley's Route B tasting sign-off (2026-07-31, "taste ok — with: fix code-block + quote editor-host rendering in Plan 28-05") — the date + verdict text baked verbatim into the CHANGELOG's Added subsection, MIGRATION.md v8.2.0, AGENTS.md Phase 28 addendum, and composite-nodes-layer.md §5 Phase 28 addendum.
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 06
    provides: The shipped whitelist sanitizer + its AGENTS.md note text (Plan 28-06 SUMMARY produced the exact note text; this plan lands it as gotcha #4a and materially in CHANGELOG.md's Security subsection + MIGRATION.md's "Note on link sanitization" subsection).

provides:
  - CHANGELOG.md v8.2.0 section staged with `<YYYY-MM-DD>` date placeholder preserved for Plan 28-12 substitution at bump-commit time.
  - MIGRATION.md v8.2.0 upgrade section staged: no-code-change lede + bump-both-packages block + minimal TS + .NET usage examples + bundling note + link sanitization note.
  - AGENTS.md Phase 28 (v8.2.0) addendum block inserted after the Phase 27 state-axis-uniformity block in §Route B composite-nodes layer.
  - AGENTS.md gotcha #4a inserted between #4 and #5 — the shipped-whitelist-sanitizer contract from Plan 28-06.
  - `.planning/design/composite-nodes-layer.md` §4 shipped-recipe inventory table gains the RichTextToolbarNode row.
  - `.planning/design/composite-nodes-layer.md` §5 layered-adoption-order gains Phase 27 + Phase 28 addendum blocks + §9 change log entry.
  - Green-tree guardrail re-verification (fast subset: `npm run build` + `npm run check:test-types`) — both exit 0; no code files touched.

affects: [28-12 (release ritual — Plan 28-12 substitutes the CHANGELOG's `<YYYY-MM-DD>` placeholder with the actual release date at the atomic bump-commit, per the Phase 27 27-10 → 27-11 handoff pattern; also bumps npm 8.1.0 → 8.2.0 and NuGet 8.1.0 → 8.2.0 in the same commit as the staged doc edits)]

# Tech tracking
tech-stack:
  added: []  # No new deps — docs-only plan
  patterns:
    - "Release-staging docs plan: separates the doc edits from the bump-commit so Plan 28-12 knows exactly what to atomically commit + publish + tag without confusion or accidental doc-only commits. Byte-aligned with Phase 27's 27-10 → 27-11 handoff pattern."
    - "`<YYYY-MM-DD>` date placeholder in CHANGELOG heading — load-bearing signal that the release plan (Plan 28-12) substitutes at bump-commit time (banked Phase 27 handoff pattern)."
    - "Conditional-on-SUMMARY doc content: Task 1 read Plan 28-06's SUMMARY to determine whether the sanitizer landed (it did), then included the sanitization notes in CHANGELOG + MIGRATION; would have omitted them if the audit had been CLEAN. Threat T-28-28 mitigation."

key-files:
  created:
    - ".planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-11-SUMMARY.md (this file)"
  modified:
    - "CHANGELOG.md — +42 lines (new v8.2.0 section at head; Added / Security / Note subsections). Existing v8.1.0 + earlier content preserved byte-for-byte."
    - "MIGRATION.md — +152 lines (new Upgrading to v8.2.0 section at head; no-code-change lede + bump-both-packages block + minimal TS + .NET usage examples + bundling note + link sanitization note). Existing v8.1.0 + earlier content preserved byte-for-byte."
    - "AGENTS.md — +9 lines total across two insertions: (a) Phase 28 (v8.2.0) addendum block appended to the Route B composite-nodes layer section immediately after the Phase 27 block (5 bullets: RichTextFieldNode primitive rationale + D-06 markdown-string wire + D-08 floor, RichTextToolbarNode composite + tasting sign-off + Phase 27 state-axis-uniformity precedent adoption, D-04 bundled TipTap + lazy-import + fail-loud on load failure, cross-reference to gotcha #4a); (b) gotcha #4a (markdown link scheme sanitization) inserted between #4 and #5 — the shipped WHITELIST contract from Plan 28-06 SUMMARY note text, verbatim + expanded for cross-references."
    - ".planning/design/composite-nodes-layer.md — +17 lines total across three insertions: (a) §4 shipped-recipe inventory table gains RichTextToolbarNode row (wire type \"rich-text-toolbar\"; consumes cell notes framework-owned TipTap chain wiring + default 11-tool D-08 floor via omission + Ashley tasting sign-off); (b) §5 gains Phase 27 addendum block + Phase 28 addendum block (mirrors the AGENTS.md pattern; two structural properties noted for future composite plans: leaf-input-primitives-don't-earn-inventory-rows per §3 typed-slots governance + framework-owned default toolbar via omission as the sensible-default-via-omission pattern); (c) §9 change log entry (2026-08-02, Phase 28 additions, additive only)."

key-decisions:
  - "Sanitizer disposition = MITIGATION LANDED (per Plan 28-06 SUMMARY: audit found stored-XSS gap on both backends for javascript:/data:/vbscript:/file: schemes; shipped whitelist sanitizer + 19+19 byte-parallel tests + byte-parity fix). Included the sanitization notes in CHANGELOG's `### Security` subsection (prominent, not buried in Added) and MIGRATION's dedicated `### Note on link sanitization` subsection. Executed the alternative in Task 1's action per the conditional-on-SUMMARY branch."
  - "CHANGELOG structured with 4 subsections: Added / Security / Note (skipped Changed — no behavioral changes for existing consumers). Security placement matches Keep-a-Changelog convention (Added → Changed → Deprecated → Removed → Fixed → Security in order; VMS uses subset — Added → Security → Note for v8.2.0). The Security bullet is the pre-eminently-important entry per the plan's constraint 4 (`Security entry MUST be prominent, not buried in Added`)."
  - "Ashley's tasting sign-off date extracted verbatim from 28-04-SUMMARY: 2026-07-31. Baked into CHANGELOG's Added block (RichTextToolbarNode bullet), AGENTS.md Phase 28 addendum block, composite-nodes-layer.md §4 table row, composite-nodes-layer.md §5 Phase 28 addendum. Ashley's exact verdict text (`taste ok — with: fix code-block + quote editor-host rendering`) reproduced verbatim in the CHANGELOG Added bullet + AGENTS.md addendum + design doc §5 addendum for traceability."
  - "gotcha #4a numbering (rather than renumbering #5-#9 as #6-#10) — a decimal suffix on the semantically-neighboring gotcha (#4 = validation-in-state; the sanitizer's semantic neighbor is 'framework-owned validation on the read side of the wire, no consumer opt-in required to get the safe default'). Renumbering all subsequent gotchas would break every cross-reference in the file (e.g. `see gotcha #4 above` at #5, `#9 corollary` at multiple sites). Decimal-suffix insertion preserves every existing cross-reference AND keeps the semantic-neighbor placement. Same pattern is available for any future insertion into the gotchas list without a cascading renumber."
  - "AGENTS.md Phase 28 addendum block references gotcha #4a as `see gotcha #4a below` — internal cross-reference that lets a reader of the Route B section follow the sanitizer thread without needing to open a separate doc. The reverse doesn't hold (gotcha #4a doesn't reference the Phase 28 addendum) because a Critical-Gotcha reader is not necessarily a Route-B-composite reader; each entry stands on its own."
  - "Composite-nodes-layer.md §5 addendum for Phase 28 explicitly notes two Route A/Route B fenceposts (RichTextFieldNode-is-leaf-input-primitive-not-Route-B-composite + framework-owned-default-toolbar-via-omission) that future composite plans should NOT re-litigate. Same shape as the Phase 27 addendum in AGENTS.md, which locked the state-axis-uniformity precedent for future composites. This is the docs-as-precedent pattern — future planners inherit the shape without re-deriving it."
  - "The `<YYYY-MM-DD>` placeholder in the CHANGELOG heading intentionally NOT substituted in this plan — Plan 28-12 owns the substitution as part of its atomic bump-commit (per T-28-29 mitigation in the plan's threat model and per the Phase 27 handoff pattern). MIGRATION heading is dateless per the existing v8.1.0 shape (no placeholder to protect there)."

patterns-established:
  - "Docs-staging plan template for composite-milestone releases: (1) read all prior-plan SUMMARIES to extract sign-off dates, sanitizer disposition, tasting URLs, exact verdict text; (2) stage CHANGELOG at head with `<YYYY-MM-DD>` placeholder in heading, no version bumps, no commits held for operator (per project git-authorization rule — atomic per-task commits authorized by /gsd:execute-phase invocation); (3) stage MIGRATION at head with no-code-change lede + bump-both-packages block + minimal usage examples per backend + capability-specific notes (bundling, sanitization); (4) AGENTS.md addendum in the Route B composite-nodes layer section mirroring the prior-phase addendum shape (Phase N → Phase N+1 continuity); (5) if new gotchas surface, insert them as decimal-suffix gotchas adjacent to their semantic neighbor (preserves cross-references); (6) design-doc-of-record §4 table row + §5 addendum block; (7) green-tree guardrail re-verification (fast subset: build + check:test-types). Byte-aligned with Phase 27's 27-10 → 27-11 handoff pattern."
  - "Conditional-on-SUMMARY doc content pattern: when a preceding plan's SUMMARY records a disposition that determines whether a doc subsection ships or not (here: sanitizer landed vs audit CLEAN → whether to include the sanitization notes), the docs-staging plan's action MUST branch on the SUMMARY read rather than baking either branch in unconditionally. Task 1's read_first list explicitly includes the 28-06 SUMMARY for this reason. Same threat model class (T-28-28) will apply to any future docs-staging plan whose upstream plan's disposition is not knowable at plan-time."
  - "Route A / Route B fencepost documentation in design-doc §5 addendum: when a phase adds a new leaf-input primitive AND a new Route B composite (as Phase 28 did with RichTextFieldNode + RichTextToolbarNode), the addendum should explicitly call out which is which and why, so future composite plans don't propose promoting the primitive to a composite (or worse, deprecating the composite in favor of extending the primitive). The 'leaf inputs don't earn Route B rows' rule is documented in §3 typed-slots governance but easy to forget; the §5 addendum reifies it against the specific new nodes."

requirements-completed: [RICH-08]

# Metrics
duration: ~20 min (autonomous portion; excludes green-tree guardrail run which is machine-verifiable)
completed: 2026-08-02
---

# Phase 28 Plan 11: v8.2.0 docs staging Summary

**Staged all 4 doc edits for the v8.2.0 aligned release. CHANGELOG.md v8.2.0 section (Added / Security / Note) with date placeholder preserved. MIGRATION.md v8.2.0 upgrade section with additive-only guidance, usage examples per backend, bundling note, and dedicated link-sanitization note. AGENTS.md Phase 28 addendum block + gotcha #4a insertion. Design-doc-of-record §4 inventory table row + §5 addendum blocks + §9 change log entry. Green-tree guardrail re-verified (npm run build + npm run check:test-types — both exit 0). No code files touched. Plan 28-12 (release ritual) unblocked with the atomic-bump-commit content pre-staged; only remaining action is the `<YYYY-MM-DD>` substitution + version bumps + registry publish + tag + main-advance.**

## Performance

- **Duration:** ~20 min (autonomous portion; excludes the green-tree guardrail run)
- **Started:** 2026-08-02
- **Completed:** 2026-08-02
- **Tasks:** 4 (all atomic commits per task per project git-authorization rule)
- **Files created:** 1 (this SUMMARY)
- **Files modified:** 4 (CHANGELOG.md, MIGRATION.md, AGENTS.md, .planning/design/composite-nodes-layer.md)

## Sanitizer disposition (baked into CHANGELOG.md + MIGRATION.md conditionally)

**Sanitizer LANDED per Plan 28-06 SUMMARY:** the audit found that every dangerous URL scheme (`javascript:`, `data:`, `vbscript:`, `file:`) reached `InlineRun.href` unfiltered by default on BOTH backends (opt-in `linkHrefRewrite` hook was the only sanitization surface). Plan 28-06 shipped a shipped-by-default whitelist sanitizer at every href emission site + 19+19 byte-parallel adversarial tests + a .NET plain-collapse byte-parity fix.

**Docs reflect this disposition:**
- CHANGELOG.md v8.2.0 gains a **prominent `### Security` subsection** (NOT buried in Added, per plan constraint 4). The Security bullet documents the pre-existing gap (adversarial inputs quoted verbatim), the shipped whitelist (`http`, `https`, `mailto`, `tel`, `ftp` + relative), the runs-before-`linkHrefRewrite` composition guarantee, the byte-parity fix, and the .NET Markdown companion re-inheritance path.
- MIGRATION.md v8.2.0 gains a dedicated `### Note on link sanitization (shipped default; both backends)` subsection describing the shipped whitelist, the composition with `linkHrefRewrite`, the future extension shape (`MarkdownOptions.additionalAllowedSchemes`), and the visible-text behavior on sanitization (regular link vs autolink — the label-preservation semantics per Plan 28-06).
- AGENTS.md gains a new gotcha #4a (adjacent to gotcha #4 — validation-in-state — the sanitizer's semantic neighbor) reproducing the exact AGENTS.md note text from Plan 28-06 SUMMARY, expanded with the "consumers need to allow additional scheme" + "consumers want stricter whitelist" cross-references.
- `.planning/design/composite-nodes-layer.md` §5 Phase 28 addendum notes the sanitizer as a cross-cutting markdown pipeline change that future Route B composites emitting `InlineRun.href` will inherit transparently on rebuild.

## Ashley's tasting sign-off date (baked into docs)

**Extracted from Plan 28-04 SUMMARY:** `2026-07-31` — the D-03 Route B tasting served on the tailnet at `http://100.113.23.63:3021/`; Ashley signed off with `taste ok — with: fix code-block + quote editor-host rendering in Plan 28-05` (verdict + adjustments folded into Plan 28-05's CSS scope).

**Baked into:**
- CHANGELOG.md v8.2.0 Added block (RichTextToolbarNode bullet)
- MIGRATION.md v8.2.0 (implicit via the Route B composite reference — the tasting is the composite's earned-a-composite gate, but MIGRATION is consumer-facing and doesn't repeat the internal governance detail)
- AGENTS.md Phase 28 addendum block (RichTextToolbarNode bullet, verbatim verdict text)
- `.planning/design/composite-nodes-layer.md` §4 inventory table row (Ashley signed off 2026-07-31)
- `.planning/design/composite-nodes-layer.md` §5 Phase 28 addendum (verbatim verdict text quoted with attribution)

## Accomplishments

### Task 1 — CHANGELOG.md + MIGRATION.md v8.2.0 sections (commit `f7b8f30`)

Inserted a new `## 8.2.0 — <YYYY-MM-DD> (npm + NuGet aligned)` section at the head of `CHANGELOG.md` (immediately above the v8.1.0 entry), with:

- **Milestone framing** — one-line summary of the rich text WYSIWYG input primitive milestone, references to composite-nodes-layer.md §4 and Phase 28 in ROADMAP.md.
- **Added subsection (4 bullets):**
  1. RichTextFieldNode wire type (both backends) — leaf-input primitive; wire value = markdown string; D-08 feature-surface floor spelled out; .NET twin attribute discipline per gotcha #8 documented.
  2. RichTextToolbarNode Route B composite (both backends) — typed slot + closed-enum variance; tasting sign-off + verbatim verdict; framework-owned defaults; default 11-tool floor auto-renders when toolbar is OMITTED (this behavior is load-bearing for consumer ergonomics — consumers get a working editor for free without composing a toolbar).
  3. TipTap 2.x + turndown bundled into main package (D-04); lazy-import + zero-bytes-if-unused guarantee; the specific verification methods (adapter test + Vite chunk-split output).
  4. Fifth composite adopting the Phase 27 state axis uniformity precedent.
- **Security subsection (1 detailed bullet)** — the shipped whitelist sanitizer contract from Plan 28-06. Placed prominently (own subsection, NOT buried in Added per plan constraint 4). Documents the pre-existing gap with adversarial input quoted, the shipped whitelist (`http`, `https`, `mailto`, `tel`, `ftp` + relative), the sanitizer-runs-before-`linkHrefRewrite` composition guarantee, byte-parallel test coverage (19+19), byte-parity fix to .NET plain-collapse, and future-extension shape for consumers who need additional schemes (`MarkdownOptions.additionalAllowedSchemes`).
- **Note subsection (4 bullets)** — protocol token unchanged (viewmodel-shell/1.0); MINOR bump + Markdown companion re-inheritance path; consumers who don't render RichTextFieldNode see zero effect (opt-in per node); fail-loud on TipTap load failure per capability-seam rule.

Inserted a new `## Upgrading to v8.2.0` section at the head of `MIGRATION.md`, with:

- **No-code-change lede** + bump-both-packages code block (npm + dotnet commands per existing v8.1.0 shape).
- **New capability: RichTextFieldNode + RichTextToolbarNode** subsection with minimal TS + .NET usage examples showing (a) the default 11-tool toolbar auto-renders when `toolbar` is omitted, (b) explicit `RichTextToolbarNode` used to customize.
- **Note on bundling** subsection — D-04 lazy-import posture + Chart.js precedent + fail-loud behavior on TipTap load failure.
- **Note on link sanitization** subsection — dedicated section (parallel to CHANGELOG's Security subsection) documenting the shipped whitelist, composition with `linkHrefRewrite` (TS + .NET code samples), the "allow additional scheme" future-extension shape, and the visible-text behavior on sanitization (regular link collapses to bare TextNode.value = label; autolink preserves the raw label as visible text — the "dead href, honest failure" posture).

**Task 1 acceptance-criteria greps (all pass):**
- `grep -c '^## 8.2.0' CHANGELOG.md` = **1** ✓
- `grep -c '## Upgrading to v8.2.0' MIGRATION.md` = **1** ✓
- `grep -c 'RichTextFieldNode' CHANGELOG.md` = **5** ✓
- `grep -c 'RichTextToolbarNode' CHANGELOG.md` = **3** ✓
- `grep -c 'TipTap' CHANGELOG.md` = **4** ✓
- `grep -c '<YYYY-MM-DD>' CHANGELOG.md` = **1** ✓ (Plan 28-12 substitution point preserved)
- `grep -c '### Security' CHANGELOG.md` = **1** ✓ (prominent, own subsection)
- Existing `## 8.1.0` section still present ✓

### Task 2 — AGENTS.md Phase 28 addendum + gotcha #4a (commit `6fdc2e4`)

Inserted a `Phase 28 (v8.2.0, rich text WYSIWYG):` block immediately after the existing `Phase 27 (v8.1.0, state axis uniformity):` block in AGENTS.md's Route B composite-nodes layer section, with 5 bullets:

1. RichTextFieldNode leaf-input primitive (D-01 rationale + fields spelled out + D-06 markdown-string wire + D-08 floor).
2. RichTextToolbarNode Route B composite (D-02) — typed slot + closed-enum axes + framework-owned defaults + tasting URL + Ashley's verbatim verdict + default toolbar via omission + fifth composite adopting Phase 27 state-axis uniformity.
3. TipTap 2.x + turndown bundled+lazy-imported (D-04) — verification methods + fail-loud on load failure per capability-seam rule.
4. Cross-reference to new gotcha #4a for the shipped sanitizer contract.

Inserted a new **gotcha #4a** between gotcha #4 (validation-in-state) and #5 (UnknownActionException) — the sanitizer's semantic neighbor being framework-owned validation on the read side of the wire. Content reproduces the exact AGENTS.md note text from Plan 28-06 SUMMARY, expanded with:

- Cross-reference to gotcha #8 ("an option not set is absent") for the empty-href collapse posture.
- The two future-extension shapes explicitly named: allow additional scheme (`MarkdownOptions.additionalAllowedSchemes`) + stricter whitelist (existing `linkHrefRewrite` hook receives already-sanitized href).
- Autolink-preserves-label fallback semantics.
- Explicit alignment with gotcha #4's posture ("validation happens on the READ side of the wire, framework-owned, no consumer opt-in required to get the safe default").

**Decimal-suffix numbering (`#4a`) chosen** over renumbering #5-#9 as #6-#10, because renumbering would break every cross-reference in the file (`see gotcha #4 above` at #5, `#9 corollary` at multiple sites). Decimal-suffix preserves every existing cross-reference while keeping the semantic-neighbor placement.

**Task 2 acceptance-criteria greps (all pass):**
- `grep -c 'Phase 28 (v8.2.0' AGENTS.md` = **1** ✓
- `grep -c 'RichTextFieldNode' AGENTS.md` = **3** ✓
- `grep -c 'RichTextToolbarNode' AGENTS.md` = **1** ✓
- `grep -c '^4a\. ' AGENTS.md` = **1** ✓ (sanitizer gotcha adjacent to #4)
- `grep -c 'WHITELIST' AGENTS.md` = **2** ✓ (in gotcha #4a body)

### Task 3 — composite-nodes-layer.md §4 inventory row + §5 addendum + §9 change log (commit `50f3176`)

Three insertions into `.planning/design/composite-nodes-layer.md`:

**(a) §4 shipped-recipe inventory table** gains one new row after the Phase 26 release ritual row:

```
| `RichTextToolbarNode` | tools[], size, tone, state | 28 (RICH-02) | `"rich-text-toolbar"` | `RichTextToolbarNode` | ButtonNode styling; framework-owned TipTap chain wiring via the enclosing RichTextFieldNode; framework-owned toolbar layout, keyboard shortcuts, focus management, a11y (aria-labels + shortcut hints); default 11-tool D-08 floor renders automatically when `RichTextFieldNode.toolbar` is OMITTED — explicit `RichTextToolbarNode` only needed to customize. Composite shape approved via before/after tasting at `http://100.113.23.63:3021/`; Ashley signed off 2026-07-31 |
```

**(b) §5 layered-adoption-order** gains two addendum blocks:

- **Phase 27 addendum (v8.1.0, state axis uniformity — landed 2026-07-30)** — records the axis uniformity precedent for future composites. Mirrors the AGENTS.md Phase 27 addendum but pitched at design-doc consumers (planners reading the milestone-order narrative).
- **Phase 28 addendum (v8.2.0, rich text WYSIWYG — landed 2026-08-02)** — records the two structural Route A/Route B fenceposts worth calling out for future composite plans: (1) RichTextFieldNode is a leaf-input primitive per D-01 (leaf inputs don't earn Route B rows; only the toolbar customization seam does); (2) framework-owned default toolbar via omission (D-02 anticipated axis, shipped in v8.2.0) — the same "sensible default via omission" pattern as `SectionNode.layout` defaulting to `stack`. Also notes the Plan 28-06 shipped whitelist sanitizer as a cross-cutting markdown-pipeline change future composites emitting `InlineRun.href` will inherit transparently.

**(c) §9 change log** gains a 2026-08-02 entry recording the Phase 28 additions as additive-only (no §1-§3 amendment), per the doc's "extend, never contradict" convention.

**Only RichTextToolbarNode goes in the composite inventory** — RichTextFieldNode is a leaf-input primitive per D-01, not a Route B composite (per §3 typed-slots governance: "leaf inputs don't earn Route B rows; only the toolbar customization seam does"). The Phase 28 addendum reifies this rule explicitly against the specific new nodes so future planners don't propose reversing the classification.

**Task 3 acceptance-criteria greps (all pass):**
- `grep -c 'RichTextToolbarNode' .planning/design/composite-nodes-layer.md` = **5** ✓
- `grep -c 'rich-text-toolbar' .planning/design/composite-nodes-layer.md` = **2** ✓
- `grep -c '| \`RichTextFieldNode\`' .planning/design/composite-nodes-layer.md` = **0** ✓ (RichTextFieldNode intentionally NOT in composite inventory)
- Phase 28 addendum block present ✓ (2 mentions — the block heading + the change-log entry)

### Task 4 — Green-tree guardrail re-verification

- `cd viewmodel-shell && npm run build` — exit 0. Only output: `> @ashley-shrok/viewmodel-shell@8.1.0 build` + `> tsc -b tsconfig.tui.json` (no errors, no warnings).
- `cd viewmodel-shell && npm run check:test-types` — exit 0. Only output: `> @ashley-shrok/viewmodel-shell@8.1.0 check:test-types` + `> tsc -p tsconfig.test.json --noEmit` (no errors, no warnings).
- `git status --short` — confirms only the expected doc files were modified this plan; the pre-existing `.planning/ROADMAP.md` M mark + 15 untracked Phase 27 planning files + `.vite/` build cache + `server.pid` were present at session start (verified against the initial gitStatus snapshot) and are NOT touched by this plan.

**No code file was accidentally modified.** Task 4 acceptance criteria met; no source-code change, so no commit for Task 4 (runtime verification only).

## Task Commits

| # | Task | Commit    | Files |
|---|------|-----------|-------|
| 1 | Stage v8.2.0 CHANGELOG + MIGRATION entries with date placeholder | `f7b8f30` | CHANGELOG.md (+42 lines), MIGRATION.md (+152 lines) |
| 2 | Add Phase 28 v8.2.0 addendum + sanitizer gotcha #4a to AGENTS.md | `6fdc2e4` | AGENTS.md (+9 lines total across two insertions) |
| 3 | Add RichTextToolbarNode to composite-nodes-layer §4 + Phase 28 §5 addendum | `50f3176` | .planning/design/composite-nodes-layer.md (+17 lines total across three insertions) |
| 4 | Green-tree guardrail re-verification | — | (runtime verification; no commit — build + check:test-types both exit 0) |

## Files Created/Modified

See `key-files.modified` in the frontmatter for the full per-file diff summary.

## Decisions Made

See `key-decisions` in the frontmatter for the seven interpretive decisions taken during doc staging (sanitizer disposition + Security subsection placement, CHANGELOG structure, Ashley tasting date extraction + verbatim verdict placement, gotcha #4a decimal-suffix numbering, AGENTS.md ↔ gotcha #4a cross-reference asymmetry, design-doc §5 Route A/Route B fencepost reification, `<YYYY-MM-DD>` placeholder preservation).

## Deviations from Plan

**None.** All 4 tasks executed exactly as planned:

- Task 1 conditional-on-28-06-SUMMARY branch: sanitizer landed per SUMMARY → included sanitization notes (as planned).
- Task 1 `<YYYY-MM-DD>` placeholder preserved intact (as planned; T-28-29 mitigation).
- Task 2 sanitizer note landed adjacent to gotcha #4 as gotcha #4a (as planned in the plan's `<read_first>` guidance about the "semantic neighbor" of gotcha #4).
- Task 3 RichTextFieldNode NOT in composite inventory (as planned; §3 typed-slots governance).
- Task 4 both guardrails exit 0; no code files touched; runtime verification passed.

No architectural changes required. No auth gates. No skipped tasks. No pre-existing test failures encountered (green-tree guardrail was already green at Plan 28-10's 3de7f2e baseline; doc-only edits could not disturb it).

## Threat Flags

None. The changes are docs-only (extending existing narrative sections and inventory tables); no new security surface, no new wire, no new code path.

Threat model dispositions from the plan's `<threat_model>`:

- **T-28-28** (CHANGELOG claims sanitizer shipped when it didn't or vice versa) — MITIGATED. Task 1's conditional-on-28-06-SUMMARY logic executed: read the SUMMARY, confirmed sanitizer landed with 19+19 tests + byte-parity fix, included the sanitization notes in CHANGELOG's Security subsection + MIGRATION's dedicated subsection + AGENTS.md gotcha #4a. If the audit had been CLEAN, the notes would have been omitted.
- **T-28-29** (Date placeholder accidentally replaced) — MITIGATED. `grep -c '<YYYY-MM-DD>' CHANGELOG.md` returns exactly **1** at plan close — the new placeholder for Plan 28-12's substitution. No stray placeholder replacement.

## Issues Encountered

None. The staging pattern (byte-aligned with Phase 27's 27-10 → 27-11 handoff) is well-understood; the prior-plan SUMMARIES contained all the required data (sign-off date, verdict text, sanitizer disposition, exact note text); the doc-of-record structures were already extended by prior phases in the same locations.

## Next Phase Readiness

**Plan 28-12 (release ritual) is unblocked.** Everything needed at bump-commit time is pre-staged:

- CHANGELOG.md v8.2.0 section body complete with `<YYYY-MM-DD>` placeholder ready to substitute.
- MIGRATION.md v8.2.0 section body complete.
- AGENTS.md Phase 28 addendum + gotcha #4a landed.
- Design doc §4 inventory table row + §5 addendum landed.

Plan 28-12's atomic bump-commit needs to:

1. Substitute `<YYYY-MM-DD>` in CHANGELOG.md heading with the actual release date.
2. Bump `viewmodel-shell/package.json` `version` from `8.1.0` → `8.2.0`.
3. Bump `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>` from `8.1.0` → `8.2.0`.
4. Commit all 5 files atomically as the release commit.
5. Run the operator-gated auth precheck (`npm whoami` succeeds; `$NUGET_API_KEY` present in shell).
6. `npm publish` + registry-latest verification via `curl` (per AGENTS.md; NOT `npm view`).
7. `dotnet pack` + `dotnet nuget push` + registry-latest verification via `curl`.
8. Annotated tag `v8.2.0` at release commit + push.
9. Verify main-ancestor: `git merge-base --is-ancestor v8.2.0 main` exits 0.
10. Announce on `#vms-changelog` (verify room ID against `/joined_rooms` before baking per banked Ashley directive).

Per AGENTS.md working-agreement, the version bump is operator-gated — Plan 28-12 is `autonomous: false` per the phase's original planning.

## Self-Check

**1. Created files exist:**

- `.planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-11-SUMMARY.md` → FOUND (this file).

**2. Modified files show expected changes:**

- `CHANGELOG.md` → `grep -c '^## 8.2.0' CHANGELOG.md` = **1** ✓; existing `^## 8.1.0` still present.
- `MIGRATION.md` → `grep -c '## Upgrading to v8.2.0' MIGRATION.md` = **1** ✓; existing `## Upgrading to v8.1.0` still present.
- `AGENTS.md` → `grep -c 'Phase 28 (v8.2.0' AGENTS.md` = **1** ✓; `grep -c '^4a\. ' AGENTS.md` = **1** ✓.
- `.planning/design/composite-nodes-layer.md` → `grep -c 'RichTextToolbarNode' .planning/design/composite-nodes-layer.md` = **5** ✓; `grep -c 'rich-text-toolbar' .planning/design/composite-nodes-layer.md` = **2** ✓.

**3. Commits exist:**

- `f7b8f30` → FOUND (`docs(28-11): stage v8.2.0 CHANGELOG + MIGRATION entries with date placeholder`).
- `6fdc2e4` → FOUND (`docs(28-11): add Phase 28 v8.2.0 addendum + sanitizer gotcha #4a to AGENTS.md`).
- `50f3176` → FOUND (`docs(28-11): add RichTextToolbarNode to composite-nodes-layer §4 + Phase 28 §5 addendum`).

**4. Green-tree guardrail:**

- `npm run build` exit 0 ✓
- `npm run check:test-types` exit 0 ✓
- No code files touched (verified via `git status --short` against the initial gitStatus snapshot — pre-existing `.planning/ROADMAP.md` M mark + Phase 27 untracked files + `.vite/` + `server.pid` unchanged).

## Self-Check: PASSED
