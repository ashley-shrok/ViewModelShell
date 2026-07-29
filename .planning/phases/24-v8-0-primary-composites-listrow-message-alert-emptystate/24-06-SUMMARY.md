---
phase: 24-v8-0-primary-composites-listrow-message-alert-emptystate
plan: 06
subsystem: demo-showcase
tags: [showcase, composites, fleet-adoption, demo-adoption]
requires:
  - demo/Showcase/frontend/src/main.ts (existing Foundations section from 23-07)
  - viewmodel-shell/src/index.ts (ListRowNode / MessageNode / MessageListNode / AlertNode / EmptyStateNode interfaces shipped by 24-01..24-04)
provides:
  - "v8.0.0 Primary Composites section in Showcase demo — visual + typed proof that all 4 primaries are consumable end-to-end under strict tsconfig"
affects:
  - demo/Showcase/frontend/src/main.ts
tech-stack:
  added: []
  patterns:
    - "Fleet-adoption discipline (banked from UseVmsShellStaticFiles 6.7.0) — composites ship WITH Showcase demonstration in same batch"
    - "Action-name namespacing (`showcase-primaries-*`) — prevents collision with existing Showcase actions and future sections"
key-files:
  created: []
  modified:
    - demo/Showcase/frontend/src/main.ts (+119 lines, new Primary Composites section)
decisions:
  - "icon:\"inbox\" substituted with icon:\"receipt\" for EmptyStateNode — inbox is NOT in the shipped Lucide subset (grepped IconName union in index.ts); receipt is thematically appropriate for the \"No orders yet\" example."
  - "sparkles icon override used on the info alert (thematically appropriate for \"new version available\") — confirmed shipped in IconName union."
  - "Extended the PATTERNS.md §10 baseline (3 list rows → 6 list rows) to satisfy plan directive #1 requesting 4-5 rows with mixed tones + state:\"done\" + state:\"disabled\" + one whole-row action. All 4 semantic tones plus neutral demonstrated; three lifecycle states (active/high/done/disabled) exercised."
  - "MessageNode conversation extended from 2 messages to 3 (user + assistant + user) per plan directive #1 requesting the user↔assistant↔user turn shape."
metrics:
  duration_minutes: 3
  tasks_completed: 1
  files_modified: 1
completed: 2026-07-29
---

# Phase 24 Plan 06: Showcase adopts v8.0.0 Primary Composites Summary

Fleet-adoption discipline for the composite-nodes layer: the Showcase demo now grows a **v8.0.0 Primary Composites** section immediately after the shipped Foundations section (from Phase 23 plan 23-07), demonstrating all four primaries (ListRowNode + ListNode variant:"rows", MessageNode + MessageListNode, AlertNode, EmptyStateNode) in situ with realistic content — so consumers reading the reference app see the primitives *used*, not just documented.

## What Shipped

One coherent commit (ce3993d) adds a new SectionNode entry to `demo/Showcase/frontend/src/main.ts` (+119 lines), structured per PATTERNS.md §10 with a heading, muted intro blurb, and four subsections (one per composite):

- **COMP-05 ListRowNode + ListNode(variant:"rows")** — a bordered 6-row list demonstrating:
  - Leading slot with `AvatarNode` (initials mode + icon mode + a `state:"disabled"` neutral avatar)
  - Primary/secondary/meta[] slots exercised as strings (string-lift trained typography: body+medium / muted / caption)
  - Trailing slot with `BadgeNode` (ACTIVE + DECLINED pills, tone-matched)
  - All four semantic tones (`success`, `info`, `warning`, `danger`) plus neutral
  - Three lifecycle states (`state:"active"`, `state:"high"`, `state:"done"`, `state:"disabled"`) — orthogonal to tone
  - Two whole-row `action` handlers (`showcase-primaries-open-user-ada`, `showcase-primaries-open-user-grace`) demonstrating the click-anywhere + Enter/Space keyboard affordance

- **COMP-06 MessageNode + MessageListNode** — a 3-message user↔assistant↔user thread:
  - `followTail: true` on the list (reuses SectionNode.followTail's shipped scroll-pin mechanism)
  - Avatars per message (initials-mode for user, icon-mode `sparkles` for assistant)
  - Timestamps + author + content on every message
  - `role:"assistant"` on the VMS message → tinted-info surface (vs neutral for user)
  - Two-button actions bar on the assistant message: Copy + Regenerate (always visible — no hover-reveal, per banked a11y doctrine)

- **COMP-07 AlertNode** — one per tone (4 alerts):
  - `danger` — "Payment declined" (default `x-circle` icon from tone→icon mapping)
  - `warning` — "Storage almost full" with `dismissible: true` (framework-emitted `dismiss` action)
  - `success` — "Refund processed" (default `check-circle` icon)
  - `info` — "New version available" with icon override (`sparkles` instead of default `info`)

- **COMP-08 EmptyStateNode** — one instance using the NEW v8.0 schema:
  - `title` (renamed from `heading`) + `description` (renamed from `message`)
  - Large `receipt` icon in tinted-accent circle backdrop
  - Primary CTA button (`emphasis:"primary"`) with action `showcase-primaries-empty-state-cta`

## Deviations from Plan

None from the plan; two documented icon-name adaptations expected by the plan itself:

- **`icon:"inbox"` → `icon:"receipt"`** for the EmptyStateNode. The plan's directive #1 suggested `inbox` for the empty-state icon, and the PATTERNS.md snippet used it too, but grepping the `IconName` union in `viewmodel-shell/src/index.ts` confirms `inbox` is NOT in the shipped Lucide subset. `receipt` is present (Content category) and thematically appropriate for the "No orders yet" example. The plan itself flagged this contingency in the `<action>` note: *"If any Phase 22 icon name in this block doesn't exist (`sparkles`, `inbox`), swap for one that does"*.
- **`icon:"sparkles"`** is confirmed shipped (Magic/accents category) — used as-is on the assistant's avatar and as the icon-override on the info alert.

## Action-Name Uniqueness (banked from Nelly's TODO discovery)

All 5 new action names are unique across the Showcase tree:

- `showcase-primaries-open-user-ada`
- `showcase-primaries-open-user-grace`
- `showcase-primaries-message-copy`
- `showcase-primaries-message-regenerate`
- `showcase-primaries-empty-state-cta`

Namespaced with `showcase-primaries-` prefix to keep them distinct from Foundations-section actions (which use no `showcase-` prefix — the Foundations section is largely non-interactive text/avatar demos with no ActionEvents). No collision with existing Showcase actions (verified via `grep -oE 'name: "[^"]+"' | sort | uniq -c`).

The framework's own action-name-uniqueness walker (banked TODO) provides belt-and-braces enforcement at framework level — any duplicate would have failed the vitest suite. Combined with the 5-unique / 5-total explicit grep, the two-layer verification is honest.

## Gates (Full Green-Tree)

| Gate | Command | Result |
|---|---|---|
| Strict demo tsconfig | `cd viewmodel-shell && npm run check:demo-types` | ✓ 21 demo projects type-check clean |
| Showcase Vite build | `cd demo/Showcase/frontend && npm run build` | ✓ 22 modules, 473ms, no warnings |
| Framework vitest | `cd viewmodel-shell && npx vitest run` | ✓ 73 files / 1130 passed / 1 skipped |
| Core-globals guard | `cd viewmodel-shell && npm run check:core-globals` | ✓ AGNOSTIC-03 clean |

The strict tsconfig check is the sole safety-net gate for a demo-only plan — it proves the Showcase's composite consumption calls match the shipped wire types byte-for-byte (a missing required field, a bad slot type, or an unknown enum value fails the build). All four gates green.

## Acceptance Criteria (from PLAN §<acceptance_criteria>)

| Criterion | Actual |
|---|---|
| `grep -c 'Primary Composites'` ≥ 1 | 3 ✓ |
| `grep -c 'type: "list-row"'` ≥ 2 | 6 ✓ |
| `grep -c 'type: "message-list"'` ≥ 1 with `followTail: true` | 1 with followTail:true ✓ |
| `grep -c 'type: "message"'` ≥ 2 (user + assistant) | 3 (user + assistant + user) ✓ |
| `grep -c 'type: "alert"'` ≥ 4 | 4 (one per tone) ✓ |
| `grep -c 'dismissible: true'` ≥ 1 | 1 ✓ |
| `grep -c 'type: "empty-state"'` ≥ 1 | 1 (with icon + title + description) ✓ |
| Unique showcase-* action names | 5 unique / 5 total ✓ |
| `check:demo-types` GREEN | ✓ |

## Batch-Then-Ship

Per plan directive #5, **no release ship** in this plan. v8.0.0 lands at Phase 26 after 24-07 (parity FeatureProbe extension), 24-08 (CHANGELOG entry), 24-09 (any late fleet-adoption), Phase 25 (secondary composites), and Phase 26 (final release ritual).

## Self-Check: PASSED

Verified after writing SUMMARY.md:

- ✓ `demo/Showcase/frontend/src/main.ts` exists (modified with +119 lines)
- ✓ Commit `ce3993d` exists in `git log --oneline`
- ✓ Section text "v8.0.0 Primary Composites" present in main.ts (3 occurrences)
- ✓ All 4 composite types present (list-row / message-list+message / alert / empty-state)
- ✓ Strict tsconfig gate green
- ✓ Vite build gate green
- ✓ Vitest gate green
- ✓ Core-globals gate green
