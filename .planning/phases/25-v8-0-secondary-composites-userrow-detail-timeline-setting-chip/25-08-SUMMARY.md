---
phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip
plan: 08
subsystem: parity
tags: [parity, feature-probe, secondary-composites, extend-not-new-fixture, tripwires, byte-alignment]
requires: [25-01, 25-02, 25-03, 25-04, 25-05]
provides: [parity-coverage-for-secondary-composites, per-branch-tripwires-comp-09-through-13a]
affects:
  - demo/FeatureProbe-bun/handler.ts
  - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
  - parity/fixtures/feature-probe.json
tech-stack:
  added: []
  patterns:
    - extend-not-new-fixture-v5.1-pattern
    - per-branch-expectBodyContains-tripwires-mutation-testable
    - byte-identical-cross-backend-secondary-composites-emission
    - narrow-substring-binding-dismissAction-object-open-brace
    - status-kind-enum-crossing-uniqueness-precheck
key-files:
  created:
    - .planning/phases/25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip/25-08-SUMMARY.md
  modified:
    - demo/FeatureProbe-bun/handler.ts
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - parity/fixtures/feature-probe.json
decisions:
  - "Followed the v5.1 EXTEND-not-new-fixture pattern (per Phase 24 plan 24-07 template) — appended a Secondary Composites section to the existing FeatureProbe backends and the existing feature-probe.json fixture rather than creating a new fixture. Keeps parity's per-fixture cost bounded and preserves the single-fixture-per-demo discipline."
  - "Rule 1 auto-fix — the plan's inline TS/C# code specified `checked: true` / `Checked: true` on CheckboxNode(variant:'switch'). The shipped CheckboxNode has NO `checked`/`Checked` field (state lives at the bind path). Removed the invalid property and added the required `name`:'setting-email' on both backends. The .NET twin's error surfaced during `dotnet build` (CS1739); the TS twin's error surfaced during `check:demo-types` (TS2353). Type-checks green after fix; no wire drift introduced (the field never existed on the wire in the first place)."
  - "Per plan §3(e) safety pre-check confirmed the `\"kind\":\"online\"` tripwire binds uniquely to UserRowNode.status. Only two `\"kind\":\"...\"` occurrences exist on the FeatureProbe wire: `\"kind\":\"line\"` (ChartNode's chart kind) and `\"kind\":\"online\"` (new UserRowNode status kind). No promotion to a longer bound substring needed."
metrics:
  duration-minutes: 25
  tasks-completed: 3
  files-modified: 3
completed: 2026-07-30
---

# Phase 25 Plan 08: Parity Fixture Extension for Secondary Composites — Summary

Extends `parity/fixtures/feature-probe.json` and both FeatureProbe backends (bun/node + .NET) with a `v8.0.0 Secondary Composites` section covering all 5 shipped secondaries (UserRow, DetailList+Row, Timeline+Entry, SettingList+Row, ChipList+Chip). Adds 15 per-branch `expectBodyContains` tripwires — mutation-verified — proving each composite branch actually ran (not just structurally agreed). Parity byte-diff GREEN across `dotnet-probe`, `bun-probe`, `node-probe`.

## One-liner

15 per-branch tripwires + byte-identical Secondary Composites emission across bun/node + .NET FeatureProbe backends; parity GREEN; `"dismissAction":{` object-opener tripwire mutation-verified to bind to the chip's caller-supplied ActionEvent slot (distinct from AlertNode's `dismissible: true` boolean).

## Tasks completed

### Task 1: Extend bun/node FeatureProbe handler.ts with `secondaryCompositesSection`

**File modified:** `demo/FeatureProbe-bun/handler.ts`

**Diff summary:** Added a new `const secondaryCompositesSection: ViewNode = { type: "section", heading: "v8.0.0 Secondary Composites", variant: "card", children: [...] }` immediately after `primaryCompositesSection` and wired it into `pageChildren` between `primaryCompositesSection` and `richTextSection`. The section contains:

- **COMP-09 UserRowNode:** all slots populated — avatar (AvatarNode, initials "JD", tone info) + name (TextNode body/medium "Jane Dougherty") + meta (TextNode muted "jane.d · SRE Lead") + status `{label: "Online", kind: "online"}` + action name `user-row-open-jd`.
- **COMP-10 + 10a DetailListNode:** `labelWidth: "lg"` + 3 DetailRowNodes (Status, Assignee, Deleted with `tone: "danger"`).
- **COMP-11 + 11a TimelineNode:** 3 TimelineEntryNodes covering `danger`/`warning`/`success` tones (Incident opened / Acknowledged by Jane / Rollback verified).
- **COMP-12 + 12a SettingListNode:** `heading: "Notification preferences"` + 2 SettingRowNodes — one with `CheckboxNode(variant: "switch", bind: "settings.email")` trailing (COMP-03 pairing per CONTEXT §9), one with `ButtonNode` trailing carrying UNIQUE action name `setting-row-configure-digest`.
- **COMP-13 + 13a ChipListNode:** 4 ChipNodes covering the full slot matrix — dismissAction-only (`chip-remove-filter-active`), tone-only, action-only (`chip-toggle-tag-clickme`), and BOTH action+dismissAction (`chip-toggle-tag-both` + `chip-remove-tag-both`).

**Verification greps (all passed):**
- `secondaryCompositesSection` present + wired (3 occurrences: const decl + comment ref + pageChildren.push)
- `type: "user-row"` × 1, `type: "detail-list"` × 1, `type: "detail-row"` × 3
- `type: "timeline"` × 1, `type: "timeline-entry"` × 3
- `type: "setting-list"` × 1, `type: "setting-row"` × 2
- `type: "chip-list"` × 1, `type: "chip"` × 4
- `kind: "online"` × 1, `labelWidth: "lg"` × 1, `variant: "switch"` × 2 (Phase 24 foundations + new SettingRow trailing)
- All 6 new action names present exactly once in code
- vitest framework suite: 78 files / 1250 tests green

### Task 2: Extend .NET FeatureProbeController.cs with byte-identical Secondary Composites section

**File modified:** `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`

**Diff summary:** Added `pageChildren.Add(new SectionNode(Heading: "v8.0.0 Secondary Composites", Variant: SectionVariant.Card, Children: new ViewNode[] { ... }));` immediately after the Phase 24 Primary Composites SectionNode. Byte-identical string values to the bun twin (spot-checked below). Uses positional record constructors + named args for optional slots. Notable .NET-specific correctness:

- `UserRowStatus("Online", StatusKind.Online)` — closed enum crossing the wire, KebabEnum emits `"kind":"online"`.
- `DetailListNode(Children: ..., LabelWidth: DetailLabelWidth.Lg)` — closed enum emits `"labelWidth":"lg"`.
- `TimelineNode(Children: [...])` with `TimelineEntryNode(Time: "...", Description: new TextNode(...), Tone: Tone.Danger|Warning|Success)` — all string+ViewNode+enum crosses byte-identically.
- `SettingListNode(Children: [...], Heading: "Notification preferences")` — Heading positional-after-Children per record order.
- `ChipListNode(Children: [...])` with 4× `ChipNode` — DismissAction is ActionDescriptor (mirrors ModalNode.DismissAction, NOT AlertNode.Dismissible bool).

**Verification greps (all passed):**
- `v8.0.0 Secondary Composites` × 2 (heading + comment ref)
- `new UserRowNode` × 1 + `new UserRowStatus` × 1
- `StatusKind.Online` × 1, `DetailLabelWidth.Lg` × 1
- `new DetailListNode` × 1, `new DetailRowNode` × 3
- `new TimelineNode` × 1, `new TimelineEntryNode` × 3
- `new SettingListNode` × 1, `new SettingRowNode` × 2, `CheckboxVariant.Switch` × 2 (Phase 24 + new)
- `new ChipListNode` × 1, `new ChipNode` × 4, `DismissAction:` × 3 (2 chips + 1 comment)
- All 6 new action names present in .NET source
- `dotnet build demo/FeatureProbe/AspNetCore/*.csproj` — Build succeeded, 0 Warning(s), 0 Error(s)
- Byte-identical spot-check: `"Receive an email for every incident update."` present exactly once in both bun and .NET sources (grep confirmed)

### Task 3: Extend parity fixture `$comment` + `expectBodyContains` tripwires + run parity green

**File modified:** `parity/fixtures/feature-probe.json`

**Diff summary:** Two edits:

1. **`$comment` clause appended** at the tail of the existing 27KB `$comment` string (before the closing `"`) — a v8.0.0 (COMP-09..COMP-13, secondary composites) clause describing what the new section covers per composite + the tripwire discipline + the client-side vs wire boundary note. Preserves the append-only per-version history.
2. **15 tripwires appended** to the initial GET step's `expectBodyContains` array:
   ```json
   "\"type\":\"user-row\"",
   "\"kind\":\"online\"",
   "\"type\":\"detail-row\"",
   "\"type\":\"detail-list\"",
   "\"labelWidth\":\"lg\"",
   "\"type\":\"timeline-entry\"",
   "\"type\":\"timeline\"",
   "\"type\":\"setting-row\"",
   "\"type\":\"setting-list\"",
   "\"type\":\"chip\"",
   "\"type\":\"chip-list\"",
   "\"dismissAction\":{",
   "user-row-open-jd",
   "chip-remove-filter-active",
   "setting-row-configure-digest"
   ```

Every tripwire is a substring only ITS branch emits — mutation-testable per plan-checker C-3. Post-append the fixture has 100 initial-step tripwires (was 85), 41 total steps.

**Verification:**
- `python3 -c "import json; json.load(open('parity/fixtures/feature-probe.json'))"` — parses cleanly.
- `bun run parity/run.ts` (full gate, `dotnet` on PATH):
  ```
  Fixture 'feature-probe' across 3 backends:
    ✓ all backends agree
  ...
  ✓ Parity tests passed
  ```

## Parity gate output

**GREEN.** Full parity harness (`bun run parity/run.ts`) — every fixture, every backend agrees:
- `feature-probe` fixture across `dotnet-probe`, `bun-probe`, `node-probe`: all backends agree (41 steps captured per backend; byte-diff clean + all 100 initial-step tripwires matched).
- `feature-probe-envelope`, all sibling fixtures: all backends agree.
- Skill parity: source files byte-identical (22090B), HTTP twins byte-identical (22271B).
- Final line: `✓ Parity tests passed`.

## Mutation-test verification (per plan §3(d))

Removed both `dismissAction: { ... }` slots from bun ChipList (chips "active" and "both"). Ran parity — harness caught it loudly:

```
error: bun-probe step 'initial' did not reach the branch it claims to cover
— missing expected substring(s): "chip-remove-filter-active".
This step exists to EXERCISE that branch; if the branch no longer fires,
the step is vacuous and the cross-backend diff is silently proving nothing about it.
```

The harness stopped at the first missing substring (`chip-remove-filter-active`), but the `"dismissAction":{` object-opener tripwire would have failed identically — both bind to the removed slots. Reverted the mutation; parity re-green. **Per-branch tripwire binding proven.**

## `"kind":"online"` safety pre-check (per plan §3(e))

Captured the raw bun FeatureProbe wire body (`curl http://localhost:3006/api/probe`, 28,750 bytes) and counted every `"kind":"..."` occurrence:

```
kind-occurrences: 2
  "kind":"line" × 1   (ChartNode's chart kind, pre-existing)
  "kind":"online" × 1 (UserRowNode status kind, new in Phase 25)
substring "kind":"online" count: 1
```

Only ChartNode's `"kind":"line"` shares the `kind` field on the wire — distinct VALUE. The `"kind":"online"` tripwire binds uniquely to the UserRowNode.status branch. **No promotion to a longer bound substring needed.** (`"kind":"online"` stays as the tripwire.)

## Byte-alignment spot-check

Per plan §2 acceptance-criteria: `"Receive an email for every incident update."` (the SettingRow email-notifications description) present exactly once in each source:

```
demo/FeatureProbe-bun/handler.ts:1
demo/FeatureProbe/AspNetCore/FeatureProbeController.cs:1
```

Byte-identical. Because parity's `bun run run.ts` walks BOTH the byte-diff AND the initial-step tripwire assertions on every one of the 3 FeatureProbe backend responses, a byte drift on ANY field value in this section would have failed the run. Parity's GREEN gate is the load-bearing proof of byte-identical emission across all 15 fields per row of the Secondary Composites section.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Plan-code bug] Invalid `checked`/`Checked` field on CheckboxNode**
- **Found during:** Task 2 (`dotnet build` surfaced CS1739 first; then Task 1 verification via `npm run check:demo-types` surfaced TS2353)
- **Issue:** The plan's inline code specified `checked: true` (TS) and `Checked: true` (.NET) on the `CheckboxNode(variant:"switch")` inside SettingRow.trailing. The shipped `CheckboxNode` — both the TS `interface CheckboxNode` (`viewmodel-shell/src/index.ts:809-828`) and the .NET `public record CheckboxNode` (`viewmodel-shell-dotnet/ViewModels.cs:1434-1446`) — has NO `checked` / `Checked` field. Checked state lives on the state record at the `bind` path (`state.settings.email`); the node itself carries no checked value. The plan's PATTERNS.md §6 code block reproduced this same error verbatim. Same bug landed in Phase 25 plan 07's Showcase adoption and was auto-fixed there — same root cause, same fix.
- **Fix:** Removed `checked: true` / `Checked: true` from both backends. Added the required `name: "setting-email"` (TS) / `Name: "setting-email"` (C#) — the TS interface requires `name: string` and the .NET record's first positional arg is `Name`.
- **Files modified:** `demo/FeatureProbe-bun/handler.ts` (line 1327), `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (line 1377)
- **Committed in:** 046ea55 (same commit as the plan proper — the fix was inline before the working tree ever went green)

### Rule 2/3/4 issues: None.

### Authentication gates: None (parity runs entirely local, no external auth).

## Threat Flags

None — the plan's threat register captured every surface; the extension is pure demo backend + parity fixture with no new dispatch paths beyond the composite ActionEvent slots themselves (which are proven safe by name uniqueness + walker descent — see the 6 tripwires).

## Commit

**046ea55** — `feat(25-08): parity FeatureProbe extended with Secondary Composites section + 15 tripwires (COMP-09..13a)`

Files: `demo/FeatureProbe-bun/handler.ts` (+108 lines), `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (+81 lines), `parity/fixtures/feature-probe.json` (+17 lines, -1 line — the `$comment` string swap).

## Self-Check: PASSED

- File `demo/FeatureProbe-bun/handler.ts` — modified (verified via `git log --stat 046ea55`).
- File `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — modified (verified).
- File `parity/fixtures/feature-probe.json` — modified (verified; JSON valid, 100 tripwires present).
- Commit 046ea55 — exists on main (`git log --oneline -3 | grep 046ea55` matches).
- Parity gate output GREEN (verified via full `bun run parity/run.ts` run).
- Mutation-test verified (dismissAction removal → loud failure → revert → green).
- `"kind":"online"` pre-check proven safe (only 2 `"kind":"..."` values on wire, distinct).
- Byte-alignment spot-check confirmed (`Receive an email for every incident update.` present once per source).
