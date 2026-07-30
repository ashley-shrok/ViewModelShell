---
phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip
plan: 07
subsystem: demo-showcase
tags: [showcase, secondary-composites, fleet-adoption, user-row, detail-list, timeline, setting-list, chip-list]
requires: [25-01, 25-02, 25-03, 25-04, 25-05]
provides: [showcase-secondary-composites-section]
affects: [demo/Showcase/frontend/src/main.ts]
tech-stack:
  added: []
  patterns: [showcase-adoption-mirror-of-24-06, natural-checkbox-switch-pairing-per-COMP-12, action-name-uniqueness]
key-files:
  created: []
  modified:
    - demo/Showcase/frontend/src/main.ts
decisions:
  - "Removed the plan's suggested `checked: true|false` field from the CheckboxNode(variant:'switch') trailing controls — that field does not exist on the shipped CheckboxNode interface (the value is read from state via `bind`). Added the required `name` field instead. Rule 1 fix; caught by `check:demo-types` on the first run."
metrics:
  duration-minutes: 5
  tasks-completed: 1
  files-modified: 1
completed: 2026-07-29
---

# Phase 25 Plan 07: v8.0.0 Secondary Composites Showcase Adoption — Summary

Showcased all 5 v8.0.0 secondary composites (UserRowNode, DetailRowNode+List, Timeline+Entry, SettingRowNode+List, ChipNode+List) in the Showcase demo, mirroring Phase 24 plan 24-06's Primary Composites section structure. Closes fleet-adoption for Phase 25 per AGENTS.md UseVmsShellStaticFiles 6.7.0 discipline.

## One-liner

Adds a `v8.0.0 Secondary Composites` section to `demo/Showcase/frontend/src/main.ts` demonstrating all 5 shipped secondaries in situ — 4 UserRows covering every status kind, a DetailList with `labelWidth:"md"`, a Timeline covering 4 tones, a SettingList exercising the CheckboxNode(variant:"switch") natural pairing 3× plus 1 Button trailing, and a ChipList spanning tone + action + dismissAction combinations including a chip with both slots set.

## Tasks completed

### Task 1: Add v8.0.0 Secondary Composites section to Showcase main.ts

**Files modified:** `demo/Showcase/frontend/src/main.ts`

**Diff summary:** Inserted a single new SectionNode (heading `v8.0.0 Secondary Composites`) immediately after the existing v8.0.0 Primary Composites section (Phase 24 plan 24-06 landed) and before `Stat bar`. The new section contains:

- 5× `TextNode(style:"subheading")` + 5× `TextNode(style:"muted")` blurbs, one per composite, matching the Primary Composites section shape.
- 4× `UserRowNode` covering all four status kinds (`online`/`away`/`offline`/`busy`) with distinct avatar tones (info/success/warning/danger); first two carry `action` slots.
- 1× `DetailListNode { labelWidth: "md" }` containing 4× `DetailRowNode` (Status tone:success, Assignee, Priority tone:warning, Deleted tone:danger).
- 1× `TimelineNode` containing 5× `TimelineEntryNode` covering `danger`/`warning`/(neutral)/`success`/`info` tones — the tone spread exercises the rail+dot border variety.
- 1× `SettingListNode { heading: "Notification preferences" }` containing 4× `SettingRowNode`. Three rows use `CheckboxNode(variant:"switch")` in the trailing slot (Email/SMS/Slack DMs); the fourth (Weekly digest) uses a `ButtonNode` trailing — satisfies CONTEXT §9's "3-4 rows with switch trailing, at least one with a Button trailing" requirement.
- 1× `ChipListNode` containing 5× `ChipNode` spanning: (a) dismissAction-only + tone:success, (b) tone:warning static, (c) action-only, (d) both action AND dismissAction with tone:info, (e) dismissAction + tone:danger + icon:"alert-triangle".

**Verification:**
- `check:demo-types` (strict tsconfig across all 21 demo projects): GREEN.
- All acceptance-criteria greps pass — see counts in the "Verification greps" section below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 – Bug] CheckboxNode does not have a `checked` field**
- **Found during:** Task 1 first `check:demo-types` run.
- **Issue:** The plan's suggested code shape (25-PATTERNS.md §11 lines 1587-1632, copied into the plan) had `{ type: "checkbox", label: "", variant: "switch", checked: true, bind: "..." }`. The shipped `CheckboxNode` interface in `viewmodel-shell/src/index.ts:809` requires `name: string` and does NOT have a `checked` field — the current value is read from state via `bind` (that is the whole point of the bind model).
- **Fix:** Removed `checked: true|false` from all 3 switch checkboxes and added the required `name: "settings.email"|"settings.sms"|"settings.slack"` field.
- **Files modified:** `demo/Showcase/frontend/src/main.ts` (three checkbox entries in the SettingListNode block).
- **Post-fix:** `check:demo-types` GREEN on the next run.
- **Note for future planners:** The `checked` field in the pattern doc was a documentation bug — the strict tsconfig gate caught it on the first run, exactly as designed. Consider correcting `25-PATTERNS.md §11` in a follow-up so future consumers copy the right shape.

### Deferred Issues

None.

## Verification greps

```
Secondary Composites (heading + muted blurb line):  2
type: "user-row":                                    4  (all 4 status kinds)
  kind: "online" / "away" / "offline" / "busy":     1 / 1 / 1 / 1
type: "detail-list" (with labelWidth: "md"):         1
type: "detail-row":                                  4
type: "timeline":                                    1
type: "timeline-entry":                              5  (4+ tones covered)
type: "setting-list" (with heading):                 1
type: "setting-row":                                 4  (3 switch + 1 button trailing)
variant: "switch" (raw grep — includes 3 blurb refs): 6  (3 real + 3 doc-string references)
type: "chip-list":                                   1
type: "chip":                                        5  (spans tone + action-only + dismissAction-only + both)
showcase-secondary-* action names — unique / total:  8 / 8  (all unique)
```

## SettingRow + switch pairing evidence

Per CONTEXT §9 requirement ("3-4 setting rows with switch trailing controls, at least one with a Button trailing"):

| Row | Label | Trailing control |
|-----|-------|------------------|
| 1 | Email notifications | `CheckboxNode { variant: "switch", bind: "showcase.settings.email" }` |
| 2 | SMS alerts for P1 incidents | `CheckboxNode { variant: "switch", bind: "showcase.settings.sms" }` |
| 3 | Slack DMs | `CheckboxNode { variant: "switch", bind: "showcase.settings.slack" }` |
| 4 | Weekly digest | `ButtonNode { label: "Configure", action: { name: "showcase-secondary-setting-configure-digest" } }` |

3 switch trailing + 1 button trailing — satisfies the requirement exactly.

## Action-name uniqueness

All 8 new action names carry the `showcase-secondary-` prefix and are unique across the entire Showcase tree (verified via `grep -o 'name: "showcase-secondary-[^"]*"' | sort -u | wc -l` = 8 unique / 8 total):

- `showcase-secondary-user-open-jd`
- `showcase-secondary-user-open-al`
- `showcase-secondary-setting-configure-digest`
- `showcase-secondary-chip-remove-active`
- `showcase-secondary-chip-toggle-clickable`
- `showcase-secondary-chip-toggle-both`
- `showcase-secondary-chip-remove-both`
- `showcase-secondary-chip-remove-with-icon`

Phase 24 used the `showcase-*` prefix (without `-secondary-` scope), so no collision with existing Showcase actions.

## Icon-name substitution decisions

None. The plan's only referenced icon (`alert-triangle` on the danger chip) is a valid member of the shipped `IconName` closed union (`viewmodel-shell/src/index.ts:156` — Status group). Used as-is.

## Green-tree gate

- `npm run check:demo-types`: **GREEN** (21 demo projects, strict tsconfig).
- `npm run check:core-globals`: **GREEN** (core stays platform-agnostic — unaffected by this change, verified).
- Framework test suite / cross-backend parity / .NET tests: **NOT RUN** — this plan is Showcase-only, no framework code change, no wire change, no version bump. Per plan `<verification>`: "`check:demo-types` is the strict tsconfig proof."

## Release posture

**Not a release.** This is batch-then-ship for v8.0.0 (Phase 26). No `package.json`/`csproj` version bump; no npm/NuGet publish; no `git tag`.

## Self-Check: PASSED

**Files created:**
- `.planning/phases/25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip/25-07-SUMMARY.md` — this file, FOUND.

**Files modified:**
- `demo/Showcase/frontend/src/main.ts` — FOUND (the new section is present, `grep -c 'Secondary Composites'` = 2).

**Commits:** Deferred to operator per the working-agreement rule "Git is operator-driven, not autonomous. Do **not** create branches. Do **not** push. Do **not** `git commit` unless the user explicitly asks in that turn." No task-commit-protocol commit is written by the executor for this plan; the operator will commit when ready. The SUMMARY records the intent; the working tree carries the diff cleanly for the operator's review.
