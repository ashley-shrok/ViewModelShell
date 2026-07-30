---
phase: 260730-obc-listrow-standalone-cq-fix
plan: 01
status: complete
completed_at: 2026-07-30
---

# Quick Task 260730-obc — ListRowNode standalone CQ scope fix (npm 8.0.3)

## What shipped

**npm `@ashley-shrok/viewmodel-shell` v8.0.3** — CSS + renderer patch. NuGet unchanged (stays 8.0.0).

Fix the CSS Containment scope bug in the v8.0.1 `ListRowNode` narrow-column stack: `container-type: inline-size` on `.vms-list-row-standalone` was ineffective because CSS Containment forbids a container's own CQ rules from applying to itself. Standalone `ListRowNode`s (parent is not `.vms-list` — e.g. wrapped in `SectionNode`) silently didn't get the stack. Metis prod has been hitting this since 8.0.1 shipped.

## Files touched (executor, commit `41f49dc`)

- **`viewmodel-shell/styles/default.css`** — added `.vms-list-row-standalone-container { display: block; container-type: inline-size; }`; removed `.vms-list-row-standalone` from the `container-type` declaration (kept its border-surface styling). `@container (max-width: 28rem)` block unchanged — still targets `.vms-list-row` + `__leading`/`__content`/`__trailing` children.
- **`viewmodel-shell/src/browser.ts` (`listRow()`)** — standalone branch (`!isInList`) now wraps the emitted row `<div>` in an outer `<div class="vms-list-row-standalone-container">` before appending to parent. In-list branch (`isInList`) is byte-identical to 8.0.2 — zero DOM delta for the primary consumer path.
- **`viewmodel-shell/test/list-row.test.ts`** — updated standalone test to assert the descendant chain `div.vms-list-row-standalone-container > div.vms-list-row.vms-list-row-standalone`. Added new negative test verifying the in-list path emits NO wrapper (regression guard for byte-identical DOM on the primary path).

## Files touched (release ritual, this session)

- **`viewmodel-shell/package.json`** — version 8.0.2 → 8.0.3.
- **`CHANGELOG.md`** — 8.0.3 entry (root cause, fix mechanism, verification, consumer-visible DOM emission delta with before/after snippet).
- **`MIGRATION.md`** — 8.0.3 section: Playwright / DOM-shape tests that walked the parent chain need one extra step; `.vms-list-row-standalone` / `.vms-list-row` direct selectors unaffected; in-list rendering byte-identical.

## Green-tree gate — passed at `41f49dc` (before release commit)

| Command | Result |
|---|---|
| `npm run build` | pass |
| `npm run check:test-types` | pass |
| `npm run check:core-globals` | pass |
| `npm run check:aa-contrast` | pass |
| `npm run check:no-demo-style` | pass |
| `npm run check:demo-types` | pass |
| `npx vitest run` | 1251 passed / 1 skipped (78 files, +1 new negative test vs 8.0.2) |
| `dotnet test viewmodel-shell-dotnet/Tests` | 428 passed |
| `dotnet test demo/**/*.Tests.csproj` × 5 | 191 passed (ContactManager 39 / ExpenseTracker 30 / HelpDesk 61 / RetroBoard 33 / Tasks 28) |
| `bun run parity/run.ts` | all backends agree |

## Ashley visual sign-off — approved

Verification page at `http://100.113.23.63:41139/` section 2 with three iframes:

- **LEFT** — pre-fix `browser.js` + `default.css`, SectionNode wrapper → reproduces the Metis collapse (primary text shattered).
- **MIDDLE** — pre-fix bundle, ListNode(variant:"rows") wrapper → CQ container is the `<ul>` ancestor, stack applies (workaround Metis was NOT using).
- **RIGHT** — post-fix v8.0.3 `browser.js` + `default.css`, SectionNode wrapper → outer `.vms-list-row-standalone-container` establishes the CQ context; RIGHT visually matches MIDDLE.

Note: the iframe isolation was the second try. First attempt served ONE shared asset bundle across all three panels, which meant LEFT and RIGHT both ran post-fix code and looked identical (only MIDDLE looked different because of its `<ul>` surface treatment). Ashley caught this on first look; iframe isolation gave each panel its own bundle scope and made the A/B/C comparison honest.

Ashley: "checks out."

## Release-ritual outcome

Handled by Vicky (this session):
- npm publish 8.0.3
- Tag `v8.0.3` at release commit
- Push main + tag
- Verify `git merge-base --is-ancestor v8.0.3 main`
- Watch CI green
- Notify Molly (Metis unblocks with a plain `npm install @ashley-shrok/viewmodel-shell@8.0.3` — no composition swap needed)

## Bounty carry-forward

`listrow-narrow-collapse` (`.claude/identities/vicky/bounties/`) — closes on 8.0.3 ship + Molly's adoption confirmation. `composite-preship-adoption-gate` remains open (this is the THIRD instance in a month of a shipped composite defect firing on first real adoption — v6.12.1 tooltip clipping, 8.0.1 ListRowNode narrow-column stack, 8.0.3 standalone CQ scope; the pre-ship harness idea lives on).
