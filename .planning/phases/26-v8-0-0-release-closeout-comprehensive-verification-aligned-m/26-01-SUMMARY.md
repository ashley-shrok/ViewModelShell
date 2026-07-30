---
phase: 26-v8-0-0-release-closeout-comprehensive-verification-aligned-m
plan: 1
subsystem: infra
tags: [tailnet, vite, verification, showcase, v8.0.0, milestone-signoff]

# Dependency graph
requires:
  - phase: 23-*, 24-*, 25-*
    provides: Shipped 10 composites (COMP-05..13a), 4 foundations (COMP-01..04), 1 primitive (DividerNode), 3 wire tweaks — the full v8.0.0 milestone scope, all already adopted in demo/Showcase in situ.
provides:
  - Live tailnet-served Showcase dev server (http://100.113.23.63:8186/) bound for the duration of the Phase 26 verification window.
  - Full-milestone coverage checklist proving all 15 v8.0.0 items (10 composites + 4 foundations + 1 primitive) are present in the Showcase source.
  - Vite dev-server PID recorded for Plan 26-05 cleanup.
  - Bundle-real proof (4 Vite alias regexes) confirming the served page uses the local viewmodel-shell source, not a stale published copy.
affects: [26-03 (Ashley's checkpoint hands the URL to the operator), 26-05 (cleanup kills the recorded PID)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tailnet-scoped Vite dev server for whole-milestone visual sign-off (fleet-adoption discipline — every peer on djungelvrals@ tailnet can reach the same served page)."
    - "Vite alias regex map (viewmodel-shell/{browser,styles.css,themes/*.css,index}) resolves to local source tree — REAL-bundle invariant makes stale published-copy drift structurally impossible."

key-files:
  created:
    - ".planning/phases/26-v8-0-0-release-closeout-comprehensive-verification-aligned-m/26-01-SUMMARY.md — this file."
    - ".planning/phases/26-v8-0-0-release-closeout-comprehensive-verification-aligned-m/26-01-server.pid — PID file for Plan 26-05 cleanup (currently 2083055)."
  modified: []

key-decisions:
  - "Reused Phase 25-10 tailnet port (8186) — it was free at plan-start; keeps the URL memorable for Ashley across the two milestones."
  - "Recorded the outer wrapper PID (2083055) rather than the innermost node vite PID (2083150) — killing the wrapper cascades to the full npm/sh/node/esbuild tree in one signal (verified via pstree)."
  - "READ-ONLY discipline held: zero modifications to demo/Showcase/frontend/src/main.ts or vite.config.ts. If the coverage sweep had found a gap, the plan surfaces it via SUMMARY for the Phase 26-03 checkpoint — silent patching from a verification plan would defeat the fleet-adoption gate."

patterns-established:
  - "Milestone verification page = the shipped Showcase served over the tailnet. No bespoke verification bundle to keep in sync with the fleet-adoption in-situ demos."
  - "Coverage sweep by grep against Showcase source — cheap, fast, structurally honest (a 0 for any composite is a fleet-adoption regression in the phase that shipped it, not a Phase 26 gap)."

requirements-completed: [MILESTONE-v8.0.0]

# Metrics
duration: 2 min
completed: 2026-07-30
---

# Phase 26 Plan 1: Serve the comprehensive tailnet verification page for the v8.0.0 milestone Summary

**Showcase served at `http://100.113.23.63:8186/` with all 15 v8.0.0 items (10 composites, 4 foundations, 1 primitive) grep-proven present in the source, HTTP 200 confirmed, Vite PID 2083055 recorded for later cleanup.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-07-30T14:14:20Z
- **Completed:** 2026-07-30T14:15:48Z
- **Tasks:** 2
- **Files modified:** 2 (SUMMARY.md + server.pid; both created)

## Accomplishments
- Confirmed `demo/Showcase/frontend/src/main.ts` covers the FULL v8.0.0 milestone scope (10 composites + 4 foundations + 1 primitive + 3 wire tweaks) at grep level — every row hit >= 1.
- Confirmed EmptyStateNode is on the NEW v8.0 shape (`title:` / `description:`) — the sole v8.0.0 breaking wire change landed at the Showcase callsite.
- Verified the Vite alias regex map resolves to local `viewmodel-shell/src/` sources — the REAL-bundle invariant holds.
- Started Vite dev server bound to the tailnet IP `100.113.23.63` on port `8186`; `curl -sI` returned `HTTP/1.1 200 OK`; first-render HTML byte-count is 360 with the `main.ts` script reference present.
- Recorded PID `2083055` in `.planning/phases/26-*/26-01-server.pid` so Plan 26-05 can cleanly kill the process tree after the milestone ships.

## Tailnet URL

**`http://100.113.23.63:8186/`** — this is the URL Plan 26-03 hands to Ashley for the v8.0.0 visual sign-off. Reachable from every peer on the `djungelvrals@` tailnet.

## Vite invocation

Exact command (run from `demo/Showcase/frontend/`):

```
npx vite --host 100.113.23.63 --port 8186
```

Backgrounded + disowned so the process survives past this executor's exit.

**Process tree (root PID = 2083055):**

```
bash(2083055)---npm exec vite -(2083057)-+-sh(2083148)---node(2083150)   ← owns port 8186
                                         |               +-esbuild(2083178)
                                         |               `-{node worker threads}
                                         `-{npm exec vite -}(worker threads)
```

**Cleanup command (Plan 26-05):**

```
kill $(cat .planning/phases/26-v8-0-0-release-closeout-comprehensive-verification-aligned-m/26-01-server.pid)
```

Killing PID 2083055 cascades to the entire tree (SIGTERM to the wrapper bash → npm exec → sh → node vite → esbuild + worker threads).

## Curl smoke

```
$ curl -sI http://100.113.23.63:8186/ | head -1
HTTP/1.1 200 OK

$ curl -s http://100.113.23.63:8186/ | wc -c
360

$ curl -s http://100.113.23.63:8186/ | grep -c '<script.*main\.ts\|main\.ts"'
1
```

360 bytes is the Vite dev-server HTML shell that mounts `/src/main.ts` (the framework's own aliased local build is served on demand by Vite from that mount point — the real render happens in the browser).

## Full-milestone coverage checklist

Every row MUST hit `>= 1`. All 15 rows below satisfy that; no fleet-adoption gaps.

### 10 composites (COMP-05..13a) — Phases 24 + 25

| Item | main.ts hit count | Grep pattern |
|---|---:|---|
| COMP-05 ListRowNode | 9 | `list-row\|listRow\|ListRow` |
| COMP-05a ListNode variant:"rows" | 2 | `variant: "rows"\|variant:"rows"` |
| COMP-06 MessageNode | 4 | `message-list\|messageList\|Message\|MessageNode` |
| COMP-06a MessageListNode | 1 | `message-list\|messageList` |
| COMP-07 AlertNode | 14 | `alert\|Alert` |
| COMP-08 EmptyStateNode (rewritten shape) | 4 | `empty-state\|emptyState\|EmptyState` |
| COMP-09 UserRowNode | 6 | `user-row\|userRow\|UserRow` |
| COMP-10 DetailRowNode | 5 | `detail-row\|detailRow\|DetailRow` |
| COMP-10a DetailListNode | 3 | `detail-list\|detailList\|DetailList` |
| COMP-11 TimelineEntryNode | 6 | `timeline-entry\|timelineEntry\|TimelineEntry` |
| COMP-11a TimelineNode | 7 | `timeline` |
| COMP-12 SettingRowNode | 5 | `setting-row\|settingRow\|SettingRow` |
| COMP-12a SettingListNode | 3 | `setting-list\|settingList\|SettingList` |
| COMP-13 ChipNode | 12 | `chip\|Chip` |
| COMP-13a ChipListNode | 3 | `chip-list\|chipList\|ChipList` |

### 4 foundations (COMP-01..04) — Phase 23

| Item | main.ts hit count | Grep pattern |
|---|---:|---|
| COMP-01 TextNode caption tier | 1 | `style: "caption"\|style:"caption"` |
| COMP-02 TextNode weight axis | 3 | `weight: "\|weight:"` |
| COMP-03 CheckboxNode variant:"switch" | 7 | `variant: "switch"\|variant:"switch"` |
| COMP-04 AvatarNode | 34 | `avatar\|Avatar` |

### 1 new primitive (Phase 24)

| Item | main.ts hit count | Grep pattern |
|---|---:|---|
| DividerNode | 1 | `divider\|Divider` |

### 3 wire tweaks

Wire tweaks are covered by their host composites — no separate row (per plan spec):

- **EmptyStateNode `heading`→`title` + `message`→`description` rename (v8.0 breaking)** — verified at line 433–437 of `main.ts`: the callsite uses `title: "No orders yet"` and `description: "…"`; NO `heading:` or `message:` keys inside the EmptyState node. This is the sole breaking wire change in v8.0.0.
- Additive fields on COMP-05..13a — landed alongside their nodes, already exercised by the grep counts above.

## Bundle-real proof

`demo/Showcase/frontend/vite.config.ts` alias entries (verbatim):

```typescript
// 1. Browser adapter (BrowserAdapter class + adapter internals)
{
  find: /^@ashley-shrok\/viewmodel-shell\/browser$/,
  replacement: resolve(__dirname, "../../../viewmodel-shell/src/browser.ts"),
},

// 2. Default stylesheet
{
  find: /^@ashley-shrok\/viewmodel-shell\/styles\.css$/,
  replacement: resolve(__dirname, "../../../viewmodel-shell/styles/default.css"),
},

// 3. Theme files (captured `name` becomes filename; ?query preserved)
{
  find: /^@ashley-shrok\/viewmodel-shell\/themes\/([a-z-]+)\.css(\?.*)?$/,
  replacement: resolve(__dirname, "../../../viewmodel-shell/styles/themes") + "/$1.css$2",
},

// 4. Core public entry (ViewModelShell class, ViewNode types)
{
  find: /^@ashley-shrok\/viewmodel-shell$/,
  replacement: resolve(__dirname, "../../../viewmodel-shell/src/index.ts"),
},
```

Every `@ashley-shrok/viewmodel-shell/*` import in `main.ts` is rewritten to a path under `viewmodel-shell/src/` or `viewmodel-shell/styles/` in this repository. The published npm package is NOT consulted at any point during the served render — bundle drift from a stale published copy is structurally impossible.

Per AGENTS.md gotcha #3 (regex-not-string aliases): each `find` is a regex with `^…$` anchors, so `viewmodel-shell` does NOT prefix-match `viewmodel-shell/browser` (the classic string-alias trap).

## Task Commits

1. **Task 1: Confirm Showcase covers the full v8.0.0 milestone scope** — READ-ONLY (grep only, no commit)
2. **Task 2: Serve Showcase over tailnet + curl smoke + record URL** — this SUMMARY + server.pid file (single atomic commit for the plan)

**Plan metadata commit:** created in this same commit (both artifacts land together — the pid file references the SUMMARY, the SUMMARY references the pid file).

## Files Created/Modified

- `.planning/phases/26-v8-0-0-release-closeout-comprehensive-verification-aligned-m/26-01-SUMMARY.md` — this file (verification record + Ashley handoff).
- `.planning/phases/26-v8-0-0-release-closeout-comprehensive-verification-aligned-m/26-01-server.pid` — records the wrapper bash PID `2083055` for Plan 26-05 cleanup.

No source files modified (READ-ONLY + serve-only discipline held).

## Decisions Made

- **Port 8186 reused from Phase 25-10** — free at plan-start (`ss -ltn | grep ':8186 ' → 0`), so no fallback needed; keeps the URL familiar to Ashley across the two consecutive milestones' sign-off.
- **Wrapper bash PID (2083055) recorded, not the inner node PID (2083150)** — a single `kill 2083055` cascades to the full tree (verified with `pstree`); simpler for Plan 26-05.
- **READ-ONLY on the Showcase source** — the coverage sweep found no gaps, but even if it had, the plan's protocol is to surface the gap via SUMMARY for Ashley's checkpoint (Plan 26-03), NOT to silently patch main.ts from a verification plan.

## Deviations from Plan

None — plan executed exactly as written. All coverage grep counts came in above the required floor; port 8186 was free on first attempt; Vite came up cleanly on first invocation; curl returned HTTP 200 on first probe.

## Issues Encountered

None.

## Handoff to Plan 26-03

**Ashley: open `http://100.113.23.63:8186/` in a real browser** (Safari on the iMac, Chrome on the desktop, or any browser on any tailnet peer). Verify:

1. The full v8.0.0 milestone renders correctly across the default theme + a representative sample of the 12 shipped themes (use the built-in theme switcher).
2. All 10 composites (COMP-05..13a) are visually present and behave correctly.
3. The 4 foundations (COMP-01..04) render at every callsite.
4. The DividerNode primitive draws a proper `<hr>` / vertical separator.
5. EmptyStateNode renders with the NEW title + description shape (line ~435 of main.ts).

If anything looks wrong, Plan 26-03 catches it before publish (Plan 26-04). If everything looks right, sign off in 26-03 and Plan 26-04 executes the npm + NuGet publish.

## Cross-plan Handoff

**Plan 26-03** reads this SUMMARY's URL section and hands `http://100.113.23.63:8186/` to Ashley.

**Plan 26-05** reads `26-01-server.pid` and runs `kill $(cat …/26-01-server.pid)` to tear down the Vite tree after publish is complete.

## Next Phase Readiness

- Verification page LIVE on tailnet — Ashley can eyeball at any moment.
- Coverage table proves the served page is honest to the milestone scope — no false-negative sign-off risk.
- PID recorded — no lingering-process risk if the operator forgets cleanup (Plan 26-05 automates it).

## Self-Check: PASSED

- FOUND: `.planning/phases/26-*/26-01-SUMMARY.md`
- FOUND: `.planning/phases/26-*/26-01-server.pid` (contents: `2083055`)
- FOUND: Vite PID 2083055 alive (`ps -p 2083055` succeeded)
- FOUND: server still returning `HTTP/1.1 200 OK` on the tailnet URL after SUMMARY write

---
*Phase: 26-v8-0-0-release-closeout-comprehensive-verification-aligned-m*
*Completed: 2026-07-30*
