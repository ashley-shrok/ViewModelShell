---
phase: 24-v8-0-primary-composites-listrow-message-alert-emptystate
plan: 07
subsystem: parity-fixture
tags: [parity, feature-probe, composites, tripwires, byte-alignment]
requires:
  - viewmodel-shell/src/index.ts (ListRowNode / MessageNode / MessageListNode / AlertNode / EmptyStateNode wire types shipped by 24-01..24-04)
  - viewmodel-shell-dotnet/ViewModels.cs (.NET twin records shipped by 24-01..24-04)
  - parity/fixtures/feature-probe.json (v5.1 EXTEND-not-new-fixture pattern from Phase 23)
provides:
  - "Parity byte-alignment proof for all 4 v8.0.0 primary composites across all 3 backends (bun, node, dotnet)"
  - "13 mutation-testable expectBodyContains tripwires proving every composite branch actually executes on every backend"
  - "Verification that the EmptyStateNode rename cascade (Plan 24-04: heading→title, message→description + new icon) reached the demo backends"
affects:
  - demo/FeatureProbe-bun/handler.ts
  - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
  - parity/fixtures/feature-probe.json
tech-stack:
  added: []
  patterns:
    - "v5.1 EXTEND-not-new-fixture (PATTERNS.md §11) — append to feature-probe fixture rather than creating a new one, so ALL existing steps continue to prove wire-alignment for the composites"
    - "expectBodyContains coverage tripwire (banked from AGENTS.md) — a diff can only prove things about code it actually RUNS; per-branch substrings catch the Class-3 defect a diff structurally cannot see"
    - "Explicit-TextNode-wrap-on-the-wire for slots typed `string | ViewNode` (TS) vs `ViewNode` (.NET) — the TS convenience is lost for byte-parity, but the parity byte-diff enforces it"
key-files:
  created: []
  modified:
    - demo/FeatureProbe-bun/handler.ts (+128 lines: primaryCompositesSection + wired into pageChildren)
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs (+104 lines: byte-identical .NET twin)
    - parity/fixtures/feature-probe.json (+17 lines: $comment clause + 13 tripwires)
decisions:
  - "icon:\"inbox\" substituted with icon:\"receipt\" (both bun + .NET) — inbox is NOT in the shipped IconName union at viewmodel-shell/src/index.ts:148-178; receipt is the same substitution Showcase (24-06) made for its EmptyStateNode. The icon choice is subordinate to the title/description tripwires which are the load-bearing proof of the rename cascade."
  - "Rule 3 (blocking issue) — bun handler switched from TS `string | ViewNode` convenience to explicit TextNode-wrapping for ListRowNode.primary/secondary/meta[], MessageNode.content, AlertNode.message. Initial byte-diff FAILED on every step for these fields because .NET forces the wrapped shape (its record type is ViewNode-only). Fixed by wrapping every string slot on the bun side. Same convention as the Showcase demo has followed since 24-06."
  - "Byte-identical field values across bun and .NET spot-verified: message-list children order, avatar initials, alert message strings, empty-state title/description, all 3 unique action names."
metrics:
  duration_minutes: 30
  tasks_completed: 3
  files_modified: 3
completed: 2026-07-29
---

# Phase 24 Plan 07: FeatureProbe parity extension — v8.0.0 Primary Composites Summary

Extended the FeatureProbe parity fixture per the v5.1 EXTEND-not-new-fixture pattern shipped in Phase 23 (plan 23-07). All 4 v8.0.0 primary composites (COMP-05..COMP-08) now serialize byte-identically across all 3 backends (dotnet-probe, bun-probe, node-probe), and 13 mutation-testable `expectBodyContains` tripwires prove every branch actually EXECUTES on every backend — not just that the backends agree with each other (the banked AGENTS.md lesson: a diff can only prove things about code it actually RUNS).

## What Shipped

Three atomic commits landed the extension:

- **Task 1** (`7c7af99`): Added `primaryCompositesSection` to `demo/FeatureProbe-bun/handler.ts` (+118 lines), wired into `pageChildren` immediately after the Phase-23 `foundationsSection`. Covers ALL 4 primaries with minimum branch coverage:
  - **COMP-05 ListRowNode** — one standalone with all slots populated (primary/secondary/meta[]/tone:"warning"/state:"high"/action:"list-row-open-42")
  - **COMP-05a ListNode(variant:"rows")** — 2 ListRowNode children (one with `leading: AvatarNode` + `state:"done"`, one bare with tone:"danger")
  - **COMP-06 MessageNode + COMP-06a MessageListNode** — MessageListNode with `followTail:true` + 2 MessageNodes (`role:"user"` + `role:"assistant"`, the assistant carrying an `actions:[ButtonNode]` bar)
  - **COMP-07 AlertNode** — 4 alerts (one per tone: danger/warning/success/info) with the warning one carrying `dismissible:true`
  - **COMP-08 EmptyStateNode** — the RENAMED fields (`title`/`description` not `heading`/`message`) + NEW `icon:"receipt"` slot + CTA `ButtonNode` with unique action name `empty-state-cta-probe`

- **Task 2** (`eacd174`): Added byte-identical .NET twin to `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (+104 lines). Every `ListRowNode.Primary`/`Secondary`/`Meta[]`, `MessageNode.Content`, `AlertNode.Message` slot uses explicit `new TextNode(..., Style: TextStyle.XXX, Weight: TextWeight.YYY)` wrapping because the .NET records are ViewNode-only (no `string | ViewNode` convenience). Same 3 unique action names: `list-row-open-42`, `message-noop-1`, `empty-state-cta-probe`.

- **Task 3** (`5100ec7`): Extended `parity/fixtures/feature-probe.json` — appended a v8.0.0 (COMP-05..COMP-08) clause to the giant `$comment` narrating every branch each backend must emit, and added 13 `expectBodyContains` tripwires to the initial GET step:

  | Tripwire | Proves |
  |---|---|
  | `"type":"list-row"` | COMP-05 ListRowNode branch fires |
  | `"type":"message"` | COMP-06 MessageNode branch fires |
  | `"type":"message-list"` | COMP-06a MessageListNode branch fires |
  | `"type":"alert"` | COMP-07 AlertNode branch fires |
  | `"type":"empty-state"` | COMP-08 EmptyStateNode branch fires |
  | `"role":"assistant"` | MessageRole enum closed-union crosses |
  | `"followTail":true` | WhenWritingDefault posture emits the literal true (false would be ABSENT) |
  | `"dismissible":true` | WhenWritingDefault posture emits the literal true |
  | `"variant":"rows"` | ListVariant.Rows crosses |
  | `"title":"No orders yet"` | EmptyStateNode uses NEW `title` field (rename cascade proof) |
  | `"description":"Once customers place orders they'll show up here."` | NEW `description` field (rename cascade proof) |
  | `list-row-open-42` | Unique action name — walker descent proof |
  | `empty-state-cta-probe` | Unique action name — walker descent proof |

## Parity Gate Result

`bun run parity/run.ts` — **GREEN** across all 3 backends:

```
Fixture 'feature-probe' across 3 backends:
  ✓ all backends agree
  ✓ all backends agree
  ✓ all backends agree
✓ Parity tests passed
```

Every one of the 85 expectBodyContains tripwires (72 pre-existing + 13 new) matched on every backend's response body, on every one of the ~40 steps of the feature-probe fixture.

## Mutation Verification

Per plan-checker C-3 and Task 3 acceptance criterion, verified that the tripwires are BOUND to their branches (not false-positive matches from unrelated emissions):

1. **Mutation**: temporarily removed `dismissible:true` from BOTH backends (bun handler.ts line 1224 + .NET FeatureProbeController.cs `Dismissible: true` argument) — a symmetric drop that keeps the byte-diff GREEN.
2. **Re-run parity**: harness FAILED LOUDLY:
   ```
   error: dotnet-probe step 'initial' did not reach the branch it claims to cover —
   missing expected substring(s): "\"dismissible\":true". This step exists to
   EXERCISE that branch; if the branch no longer fires, the step is vacuous and
   the cross-backend diff is silently proving nothing about it.
   ```
3. **Revert**: restored `dismissible:true` on both backends.
4. **Re-run parity**: GREEN again.

This is EXACTLY the Class-3 defect banked in AGENTS.md — a branch a fixture's own configuration silently stops running, the diff passes vacuously, and only per-response invariants (`expectBodyContains`) catch it. The parity harness `parity/run.ts:318-329` is the same code that caught the AlertNode.dismissible-drop and would catch any other v8.0.0-composite branch that stops firing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] icon: "inbox" not in the shipped IconName union**
- **Found during**: Task 1, verifying `IconName` union values via `grep "\"inbox\"" viewmodel-shell/src/index.ts` → 0 matches.
- **Issue**: PATTERNS.md §6 code block and 24-07-PLAN.md Task 1 action instructed `icon: "inbox"` for the EmptyStateNode. Not shipped.
- **Fix**: Used `icon: "receipt"` (bun) / `Icon: IconName.Receipt` (.NET). Both are in the shipped IconName set (index.ts:163, ViewModels.cs:402). `receipt` is thematically appropriate for the "No orders yet" example AND is the same substitution the Showcase demo (24-06) made for its Primary Composites empty-state — keeping the fleet consistent.
- **Impact**: NONE on the load-bearing tripwires. The 13 tripwires (§ above) are all about `title`/`description`/`type`/`role`/`variant`/`dismissible`/`followTail`/action-names — the icon choice is subordinate.
- **Files modified**: demo/FeatureProbe-bun/handler.ts, demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
- **Commits**: 7c7af99, eacd174

**2. [Rule 3 - Blocking] Byte-diff FAILED: TS `string | ViewNode` convenience vs. .NET ViewNode wrap**
- **Found during**: First parity run after Task 2 committed — every step failed with `$.vm.children[46].children[0].primary: {"type":"text","value":"Order #42 · Ada Lovelace","style":"body","weight":"medium"} vs "Order #42 · Ada Lovelace"`.
- **Issue**: The initial bun handler used the shipped TS convenience (`ListRowNode.primary` typed `string | ViewNode`) and passed strings directly. On the wire this serializes as a bare string. But the .NET twin's record type is `ViewNode` (not `string | ViewNode`) so it forces the caller to wrap in an explicit `new TextNode(...)`, which serializes as `{"type":"text","value":"...","style":"body","weight":"medium"}`. Cross-backend BYTE DRIFT.
- **Fix**: Updated the bun handler to use explicit `{ type: "text", value: "...", style: "body", weight: "medium" }` wrapping for every `ListRowNode.primary/secondary/meta[]`, `MessageNode.content`, and `AlertNode.message` slot. Same convention Showcase (24-06) already follows.
- **Impact**: Parity now GREEN. TS type-check still clean. No behavior change in the browser renderer (which normalizes both shapes to the same DOM output).
- **Files modified**: demo/FeatureProbe-bun/handler.ts
- **Commit**: 5100ec7

### None architectural

## Byte-alignment spot-check

Sample fields grep-matched identical across `handler.ts` (bun) and `FeatureProbeController.cs` (.NET):

```
$ grep -c "You've used 92% of your quota\." handler.ts FeatureProbeController.cs
handler.ts:1
FeatureProbeController.cs:1

$ grep -c "Order #42 · Ada Lovelace" handler.ts FeatureProbeController.cs
handler.ts:1
FeatureProbeController.cs:1

$ grep -c "Once customers place orders they'll show up here\." handler.ts FeatureProbeController.cs
handler.ts:1
FeatureProbeController.cs:1

$ grep -c "empty-state-cta-probe" handler.ts FeatureProbeController.cs
handler.ts:2  # 1 in code + 1 in comment
FeatureProbeController.cs:1
```

Byte-alignment enforced structurally by parity (byte-diff across all ~40 steps).

## Full Green-Tree Gate

Per AGENTS.md working-agreement "NEVER PUSH OR PUBLISH ANYTHING BROKEN":

| Gate | Result |
|---|---|
| `cd viewmodel-shell && npx vitest run` | ✓ 1130 tests pass, 1 skipped (73 test files) |
| `npm run check:core-globals` | ✓ AGNOSTIC-03 zero platform globals in core |
| `npm run check:demo-types` | ✓ 21 demo projects type-check clean |
| `dotnet test viewmodel-shell-dotnet/Tests` | ✓ 325 tests pass |
| `dotnet test demo/**/*.Tests.csproj` (5 projects) | ✓ 28 + 39 + 33 + 61 + 30 = 191 tests pass |
| `bun run parity/run.ts` | ✓ Parity tests passed (all backends agree) |

## Deferred Items

None. This plan's scope is fully closed by the 3 commits.

## Next Steps

- **24-08**: CHANGELOG + MIGRATION under "Unreleased — v8.0.0 (in progress)" heading. NOT this plan's scope.
- **24-09**: Full green-tree gate + AA-contrast hand-check re-verify + Showcase visual sign-off (Ashley checkpoint).
- **Phase 26**: v8.0.0 release ship (npm + NuGet publish + tags + `main` advance).

## Self-Check: PASSED

Verified all claimed artifacts exist and commits are on the branch:

- ✓ `.planning/phases/24-v8-0-primary-composites-listrow-message-alert-emptystate/24-07-SUMMARY.md` (this file)
- ✓ commit `7c7af99` — `git log --oneline` shows it
- ✓ commit `eacd174` — `git log --oneline` shows it
- ✓ commit `5100ec7` — `git log --oneline` shows it
- ✓ `demo/FeatureProbe-bun/handler.ts` extended (grep `primaryCompositesSection` returns 5 matches)
- ✓ `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` extended (grep `Primary Composites` returns 2 matches)
- ✓ `parity/fixtures/feature-probe.json` extended (JSON valid; 85 tripwires; 13 new for composites)
- ✓ Parity run GREEN across all 3 backends
- ✓ Mutation verification GREEN (dismissible:true drop caught by tripwire, then reverted)
