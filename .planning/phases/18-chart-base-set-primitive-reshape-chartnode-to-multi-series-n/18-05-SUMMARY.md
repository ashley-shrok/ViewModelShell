---
phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n
plan: 05
subsystem: api
tags: [chartnode, wire-protocol, parity, agent-skill, dotnet, typescript, feature-probe]

# Dependency graph
requires:
  - phase: 18-01
    provides: Reshaped ChartNode/ChartSeries wire type in both backends (kind?/labels[]/series[]/stacked?/title?)
provides:
  - Reshaped FeatureProbe chart emission (multi-series + tone + stacked + explicit-kind) in both .NET and bun backends
  - Widened parity/fixtures/feature-probe.json $comment describing the reshaped chart wire (byte-identical structural parity enforced by the live GET/POST steps, no baked-in expected-chart bytes needed)
  - agent-skill.md "## Chart data" section reconciled to the reshaped wire, byte-copied to AgentSkill.md
affects: [19-verification-page, chart-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "FeatureProbe chart section now carries TWO ChartNodes: one exercising the full coverage set (multi-series, per-series tone, stacked, whole-number data, title, kind omitted) and one exercising an explicit non-default `kind` literal — both backends byte-identical."
    - "Fixture $comment paragraphs are the durable record of what a static-view-shape section proves; rewriting one in place (not touching the steps array) keeps the diff scoped to documentation."

key-files:
  created: []
  modified:
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - demo/FeatureProbe-bun/handler.ts
    - parity/fixtures/feature-probe.json
    - viewmodel-shell/agent-skill.md
    - viewmodel-shell-dotnet/AgentSkill.md

key-decisions:
  - "FeatureProbe chart section reshaped to two ChartNodes rather than one: the first covers every locked coverage requirement (series.length>=2, one tone-bearing series, stacked:true, whole-number data, title, kind omitted=bar default); the second adds explicit kind:\"line\" coverage per the plan's optional suggestion, since a mandatory-only single node would never exercise a non-default kind literal on the wire."
  - "parity/fixtures/feature-probe.json required only a single-line $comment rewrite — the fixture's steps array runs live GET/POST calls and diffs backends structurally at runtime; there is no separate baked-in 'expected chart bytes' blob to update, so the diff is exactly one line (the $comment string)."
  - "Chart-section JSON example in agent-skill.md deliberately omits `kind` (defaults to bar) rather than showing kind:\"line\" alongside stacked:true, since stacked only applies to bar/area — keeping the worked example internally consistent with its own field docs."

requirements-completed: [CHARTBASE-04]

# Metrics
duration: 8min
completed: 2026-07-09
---

# Phase 18 Plan 05: FeatureProbe Chart Reshape + Skill Doc Reconciliation Summary

**Reshaped the FeatureProbe demo's chart section (both .NET and bun backends) from the retired single-series `points` shape to a multi-series + tone-bearing + stacked ChartNode plus a second explicit-`kind` chart, widened the parity fixture's `$comment` to describe the new wire, and rewrote + byte-recopied the agent-skill.md chart section — `bun run parity/run.ts` (including `check-skill.ts`) green throughout.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-07-09T09:32:00Z
- **Completed:** 2026-07-09T09:39:39Z
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` and `demo/FeatureProbe-bun/handler.ts` now emit two structurally identical `ChartNode`s in the "chart (bar)" section: a `kind`-omitted chart with `labels:["Mon","Tue","Wed"]`, two series ("Visits": no tone, palette-assigned; "Errors": `tone:"danger"`), `stacked:true`, whole-number data, and a title — plus a second chart with `kind:"line"` set explicitly to prove the literal string crosses the wire.
- `parity/fixtures/feature-probe.json`'s `$comment` Phase-12 chart paragraph rewritten in place to describe the reshaped `{kind?, labels, series:[{name,data,tone?}], stacked?, title?}` wire; `git diff --stat` confirms exactly one line changed (the single-line `$comment` field) — the `steps` array (which drives the live GET/POST parity diff) was untouched.
- `bun run parity/run.ts` is green: `dotnet-probe`/`bun-probe`/`node-probe` all captured 41 steps and agree structurally on the reshaped chart bytes.
- `viewmodel-shell/agent-skill.md` "## Chart data" section rewritten to document `kind` (closed union `bar|line|area|pie|donut`, omitted=bar), `labels[]`, `series[{name,data,tone?}]` (index-aligned to `labels`), `stacked?` (bar/area only), `title?`, and a pie/donut single-series note — replacing every reference to the retired `points`/`{label,value}` shape. Byte-copied verbatim to `viewmodel-shell-dotnet/AgentSkill.md`; `diff` confirms identical, `grep -c points` shows only the two unrelated pre-existing occurrences ("Endpoints" heading, "points at this manual").
- Full `bun run parity/run.ts` re-run after the skill edit stays green, including `check-skill.ts`'s source-tree diff (byte-identical, 14614B) and served-body twin check (byte-identical, 14857B across dotnet-helpdesk/bun-helpdesk).

## Task Commits

Each task was committed atomically:

1. **Task 1: Reshape the FeatureProbe chart emission (both backends) + the parity fixture** - `88f0296` (feat)
2. **Task 2: Reconcile agent-skill.md chart section to the reshaped wire + byte-copy to AgentSkill.md** - `fa851f6` (docs)

## Files Created/Modified
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` - `chartSection` reshaped to two `ChartNode`s (multi-series/tone/stacked + explicit-kind coverage) using the 18-01 `ChartNode(Labels, Series, Kind?, Stacked, Title?)`/`ChartSeries(Name, Data, Tone?)` records
- `demo/FeatureProbe-bun/handler.ts` - byte-twin `chartSection` reshaped identically (also serves `node-probe` via `server-node.ts`'s shared `fetchHandler`)
- `parity/fixtures/feature-probe.json` - Phase-12 chart `$comment` paragraph rewritten to describe the reshaped wire; no other content changed
- `viewmodel-shell/agent-skill.md` - "## Chart data" section reconciled to `kind`/`labels`/`series`/`stacked`/`title`
- `viewmodel-shell-dotnet/AgentSkill.md` - byte-identical copy of the updated `agent-skill.md`

## Decisions Made
See `key-decisions` in frontmatter above — the two-ChartNode FeatureProbe design (mandatory coverage node + explicit-kind node), the single-line fixture diff (no baked-in expected-bytes blob exists), and the internally-consistent skill example (kind omitted alongside `stacked:true`).

## Deviations from Plan

None - plan executed exactly as written. Both tasks followed the `<action>` instructions verbatim: the FeatureProbe reshape hit every locked coverage point (`series.length>=2`, tone-bearing series, `stacked:true`, whole-number data, title, kind omitted) plus the plan's optional second chart with an explicit `kind`; the fixture change was scoped to only the chart `$comment` paragraph as instructed; the skill doc rewrite covered `kind`/`labels`/`series`/`stacked`/`title` with a compact reshaped JSON example and was byte-copied to `AgentSkill.md` as required.

## Issues Encountered
- The `parity/fixtures/feature-probe.json` `$comment` field is a single giant JSON string with heavy internal escaping (embedded quotes as `\"`, an apostrophe as `\'`, an em dash, a `—`). A full `json.load`/`json.dump` round-trip would have preserved correctness but reformatted the entire file's hand-aligned `steps` array (padding/indentation), violating the plan's "touches only the chart bytes + the `$comment` chart paragraph" acceptance criterion. Resolved by doing a raw-text substring replace (extracting the exact old paragraph via string slicing to guarantee an exact match, building the replacement's JSON-string escaping via `json.dumps(...)[1:-1]` for correctness, then splicing back into the raw file text) — verified `git diff --stat` shows exactly 1 line changed and the file re-parses as valid JSON.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CHARTBASE-04 (parity: multi-series + tone + stacked fixture byte-identical across TS/.NET) is complete.
- All of Phase 18's plans (18-01 through 18-05) are now done: the reshaped `ChartNode`/`ChartSeries` wire type, theme palette tokens (18-02), browser adapter rendering (18-03), TUI degradation (18-04), and the FeatureProbe/parity/skill-doc reconciliation (this plan) are all in place. `bun run parity/run.ts` is green end-to-end, including the skill-doc parity twin check.
- The remaining Phase 18 requirement, CHARTBASE-06 (the full green-tree gate: vitest, parity, core-globals, framework's own `viewmodel-shell-dotnet/Tests`, and every `demo/**/*.Tests.csproj`), was not re-run as a complete suite in this plan — only `bun run parity/run.ts` was verified per this plan's explicit `<verification>` scope. A full green-tree gate pass is expected before any version bump/publish, consistent with the AGENTS.md release rules — that work belongs to Phase 19 (verification page + `5.0.0` release closeout), not this plan.
- Phase 18 is ready to be marked complete; Phase 19 (human-runnable tailnet verification page, CHANGELOG/MIGRATION, `5.0.0` publish/tag/announce) is next per the roadmap.

---
*Phase: 18-chart-base-set-primitive-reshape-chartnode-to-multi-series-n*
*Completed: 2026-07-09*

## Self-Check: PASSED

All modified files verified present on disk with expected content (grep confirmed reshaped chart emission in both FeatureProbe backends, single-line diff in feature-probe.json, reconciled chart section in both skill files). Both commit hashes (88f0296, fa851f6) verified present in `git log --oneline -3`.
