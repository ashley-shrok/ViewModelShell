---
phase: 21-v5-2-lookup-field-lookup-lookup-multiple-the-live-query-lane
plan: 08
subsystem: docs + showcase
tags: [agent-skill, lookup, protocol, showcase, parity]
requires: [21-06]
provides:
  - "agent-skill.md documents the reference picker as a first-class PUBLIC protocol (LOOK-07)"
  - "byte-identical viewmodel-shell-dotnet/AgentSkill.md twin"
  - "Showcase lookup gallery entry (preselected / candidates / multi / allowCustom)"
affects: [21-09, 21-10]
tech-stack:
  added: []
  patterns: ["canonical skill source + cp'd .NET twin, gated by parity/check-skill.ts"]
key-files:
  created:
    - .planning/phases/21-.../21-08-SUMMARY.md
  modified:
    - viewmodel-shell/agent-skill.md
    - viewmodel-shell-dotnet/AgentSkill.md
    - demo/Showcase/frontend/src/main.ts
decisions:
  - "The lookup DOES warrant a skill section (unlike v5.1's nav nodes) — the discriminating test is wire-field SEMANTICS an agent must know to drive correctly, not the existence of a new node"
  - "Protocol token stays viewmodel-shell/1.0 — these are new optional fields on an existing node, not a new verb or envelope"
  - "textArrangement deliberately NOT documented — OPEN-1 deferred it to fast-follow; it is not in the shipped type"
metrics:
  duration: ~25m
  tasks: 2
  files: 3
  completed: 2026-07-16
---

# Phase 21 Plan 08: Picker-as-public-protocol + Showcase Summary

Documented the lookup picker as a documented, first-class public protocol in `agent-skill.md` (the differentiator no surveyed platform ships) and added the Showcase gallery entry leading with the preselected-value headline.

## What landed

**Task 1 — `agent-skill.md` (commit `1fcabf4`).** A new *"Lookup / reference fields"* section, placed directly after *Non-blocking actions* so the `blocking`-is-meaningless note follows from the section that just explained `blocking`. Covers, in the file's existing voice: both inputTypes; the D1 direction invariant led with the agent's happy path (**set `bind` to the id, you never need the label, and must not supply one**); `candidates`-is-never-the-label with the cold-start rationale; the D12 order rule stated **both directions** (reading → position 0 is the server's best answer, don't re-sort; authoring → your order is what the user sees); search-as-an-ordinary-public-action with a worked JSON dispatch; the skip-the-search-entirely path; `allowCustom` as a declared axis (no bare strings, no union); empty-query-is-legitimate; D7 (caps visible, never silent — with the "if you see a cap message, narrow the query, don't conclude the record doesn't exist" agent instruction); D8 (filter is UX, never authorization — *absent from `candidates` ≠ forbidden; present ≠ permitted*). Re-copied with `cp`, never by hand.

**Task 2 — Showcase (commit `dba9cec`).** Four compositions under the existing 12-theme switcher, preselected-value first and labelled ① as the headline: preselected-no-candidates ("Sally Omer", not `u-1`); single-with-candidates; `lookup-multiple` chips; `allowCustom` free-form tags. **Zero app CSS** — no `<style>` block, no stylesheet, no inline styles.

## The skill-update judgement (recorded per the plan — the next node author will ask this)

**The discriminating test: a new NODE type does not touch the skill; a change to wire-field SEMANTICS an agent must know to drive correctly — or a new verb — does.**

- **Breadcrumb/Steps (v5.1) → no skill change.** Pure node types with no new protocol semantics. The skill enumerates the PROTOCOL, not the node catalog.
- **Toasts → skill change.** A new side-effect verb; the verb table is protocol.
- **Lookup → skill change.** Sits with toasts, not breadcrumbs, for two independent reasons: (1) it introduces field semantics an agent gets *silently wrong* by default — an agent that assumes `selected` round-trips will write labels into state and be wrong with no error; (2) design §6 explicitly says so, and it is the phase's stated differentiator (LOOK-07).

The asymmetry is the point: the lookup is the rare case where the *default assumption* (a field you read is a field you write) is wrong. That is what earns skill space.

## Verification

- `diff viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md` → **zero output** (both files +68 lines, identical).
- `bun run parity/run.ts` → **green**; `✓ skill source files byte-identical (21806B)`; `✓ skill HTTP twins byte-identical (21991B) across 2 backends` — the served bodies confirm the .NET embedded resource picked up the change, not just the file on disk.
- `npx vitest run` → **796 passed | 1 skipped** (57 files), the expected count.
- `cd demo/Showcase/frontend && npm run build` → **exit 0**. `grep -c "<style" index.html` → **0** (unchanged); no new `.css` under `demo/Showcase/frontend/src`. Build output is gitignored (`demo/*/AspNetCore/wwwroot/`), so no artifacts were committed.

## Deviations from Plan

None material. Two judgement calls worth recording:

1. **`textArrangement` deliberately NOT documented.** The design's §5 describes it, but OPEN-1 deferred it to fast-follow and `index.ts:611` confirms it is **designed and deliberately deferred** — not in the shipped type. Documenting it would have advertised a field that doesn't exist. Verified against the shipped source rather than the design doc.
2. **D13/D14 deliberately NOT documented.** Both were added to the design during execution (21-06), but both are *client-side renderer* concerns (optimistic update between round-trips; arm-backspace-by-value). A wire-driving agent has no render loop and no keyboard, so neither is agent-facing. They belong in the TSDoc/design, not the operating manual.

## Nothing found wrong with the plan or design

The plan's contract matched the shipped implementation exactly. The one thing worth flagging for the next reader is not an error but a trap avoided: **the design doc describes `textArrangement` in §5 as though it ships, and only §8/OPEN-1 reveals it doesn't.** Anyone documenting from §5 alone would advertise a nonexistent field. The shipped type source is the authority (per the standing concern→source rule), and it says so explicitly at the deferral site.

## Self-Check: PASSED

- `viewmodel-shell/agent-skill.md` — FOUND, contains "lookup" (8 occurrences).
- `viewmodel-shell-dotnet/AgentSkill.md` — FOUND, byte-identical.
- `demo/Showcase/frontend/src/main.ts` — FOUND, modified.
- Commit `1fcabf4` — FOUND. Commit `dba9cec` — FOUND.
