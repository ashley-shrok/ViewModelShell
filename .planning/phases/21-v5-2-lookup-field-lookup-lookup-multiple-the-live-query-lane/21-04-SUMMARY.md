---
phase: 21-v5-2-lookup-field-lookup-lookup-multiple-the-live-query-lane
plan: 04
subsystem: renderer
tags: [lookup, live-query, non-blocking-lane, a11y, live-region, debounce, browser]
requires:
  - "21-01 (FieldNode.searchBind/searchAction)"
  - "21-03 (the lookup arm of field())"
  - "the v4.2 non-blocking lane (Phases 14/15) — CALLED, not touched"
provides:
  - "the 300ms debounced searchAction dispatch, renderer-FORCED onto the non-blocking lane"
  - "popup-open preservation across re-render (open, NOT active)"
  - "the query-session (`querying`) flag — results open the popup and are announced"
  - "the liveRegions persistent mark-swept map + the 1400ms announce helper"
  - "the D9 node-identity proof"
  - "decorateField describedby SEEDING (an arm may pre-wire aria-describedby)"
affects:
  - "21-05 (the four races drive THIS debounced path; the chips seam is unchanged)"
  - "21-08 (the verification page drives this cadence)"
tech-stack:
  added: []
  patterns:
    - "renderer-forced lane classification via spread-last (`{...action, blocking:false}`)"
    - "a fifth instance of the chartInstances persistent+mark-swept node idiom"
    - "three independent timers with different jobs: 300ms query / 1400ms status / the lane"
key-files:
  created:
    - viewmodel-shell/test/lookup-search-dispatch.test.ts
    - viewmodel-shell/test/lookup-live-region.test.ts
  modified:
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/styles/default.css
    - viewmodel-shell/test/lookup-render.test.ts
decisions:
  - "OPEN-5's wart is now RECORDED at FieldNode.error's TSDoc (21-03 deferred it — index.ts was outside its scope)."
  - "Popup-open is preserved INSIDE the arm, not by a post-render DOM walk: `open` is a closure variable and a DOM/closure disagreement makes Escape CLEAR the selection. Proven by the RED phase."
  - "PRESERVE OPEN, NOT ACTIVE — restoring the highlight would resurrect the §7 item 14 NVDA failure."
  - "The live-region sweep reuses ONE key set (lookupKeysSeen) for both persistent lookup maps rather than a second, identical liveRegionKeysSeen."
metrics:
  duration: ~40 min
  tasks: 2
  commits: 2
  files: 6
  tests_added: 41
  completed: 2026-07-16
---

# Phase 21 Plan 04: The live-query lane + the live region Summary

Typing a lookup now asks the server — debounced at 300ms, **renderer-forced onto the v4.2
non-blocking lane with zero new lane code and zero parallel staleness state** — and the answer is
announced through a live region whose nodes survive `render()`'s `innerHTML` wipe with reference
identity intact.

## What landed

| Task | Commit | What |
|---|---|---|
| 1 | `34f9747` | The 300ms debounced, renderer-FORCED non-blocking search dispatch; adapter-held timers; OPEN-6's empty query; flush-at-fire-time; **popup-open preservation** (Rule 2) |
| 2 | `d15a63f` | `liveRegions` — the `chartInstances` idiom applied to two alternating `role=status` regions; the 1400ms announce helper; the GOV.UK set incl. loading; the hint; the D9 identity proof; OPEN-5's TSDoc wart |

**Tests:** 670 baseline → **711 passing, 1 skipped** (41 added: 18 dispatch + 23 live-region).

## Verification

- `npx tsc --noEmit` — clean.
- `npx vitest run` — **711 passed | 1 skipped**, 55 files.
- `npm run check:core-globals` — passes (the debounce is in `browser.ts`; core untouched).
- `grep -E "pendingSearch|searchSeq|lastSearchRequest" src/index.ts` — **nothing**. The lane is
  called, never touched: stale-discard, blocking-authoritative, refire-queued discard and
  latest-wins coalescing are all inherited.
- `grep -c "liveRegions" src/browser.ts` — 7 (declaration, factory, announce, reuse, sweep).

## How the tests were proven able to FAIL

**Both tasks had a genuine RED phase** (tests written first, run against the unimplemented arm):
Task 1 — **12 of 18 failed**; Task 2 — **19 of 23 failed**.

**The D9 identity proof was additionally mutation-verified**, because it is the one assertion whose
green is worth nothing if it can't fail. Mutating `lookupLiveRegions()` to rebuild the regions each
render (**the exact silent failure**) fails it with:

```
expected <div role="status" …(3)></div> to be <div role="status" …(3)></div>
```

Two **structurally identical** divs that are **different objects** — `toEqual` would PASS on that
and prove nothing. `src/browser.ts` was snapshotted per-file and restored byte-identical
(`diff` → IDENTICAL), not `git diff`'d against the tree.

**The Escape data-loss case was proven by the RED phase, not by reasoning:** before popup-open
preservation, `expect(t.state.ownerId).toBe("1")` failed with `expected '' to be '1'` — the
selection really was being wiped.

## Decision records

### OPEN-5 — the wart is now written at the type

`FieldNode.error`'s TSDoc carries the lookup note 21-03 deferred: a **search** failure reuses this
slot; do not swallow it (react-select's `loader.then(callback, () => callback())` makes a dead
backend indistinguishable from "no results" — no surveyed library has a search-error state at all);
and the wart is recorded, not hidden — `aria-invalid="true"` is semantically wrong for "the server
is down", and one slot with two meanings collides (last writer wins). A distinct slot stays purely
additive.

### The sweep key set — `lookupKeysSeen`, not `liveRegionKeysSeen`

The plan's acceptance criteria greps literally for `liveRegionKeysSeen`. **Deliberate deviation:**
this plan produced **two** persistent per-lookup maps (`searchTimers` + `liveRegions`) swept against
an identical key set. Two sets populated from the same line at the same site would be pure
redundancy and a drift hazard (add a third map, forget a third set). One `lookupKeysSeen` serves
both. The criterion's *intent* — "the sweep is driven by a per-render key set that IS reset" — holds
exactly; only the name differs.

## Deviations from Plan

**1. [Rule 2 — missing critical functionality] Popup-open preservation. Not in this plan; handed
forward by 21-03's executor.**
- **Found during:** Task 1 (RED). **This plan's debounce is what makes it fatal** — every keystroke
  re-renders and slams the popup shut ~300ms later.
- **Fix:** a pre-wipe snapshot keyed by `n.name` (`[data-vms-lookup-key]`), **restored inside the
  arm** rather than by a post-render DOM walk, because `open` is a closure variable — the RED phase
  proved a DOM/closure disagreement makes Escape take its popup-already-closed branch and **CLEAR
  the user's selection**. **Open is preserved; ACTIVE is not** (§7 item 14).
- **Commit:** `34f9747`.

**2. [Rule 2] The FIRST search's results arrived invisibly.**
- **Found during:** Task 2. The input listener opens the popup only `if (optionEls.length > 0)` —
  on a first search there are no prior options, so it cannot fire, and the snapshot has nothing to
  restore. Results landed with the popup shut; the user had to press ArrowDown to discover the
  answer they had just asked for.
- **Fix:** a `querying` flag (snapshotted alongside popup-open) marking an active search session.
  It opens the popup when results arrive **and** gates the result announcements, so a lookup that
  re-renders for unrelated reasons never narrates its candidate count at an AT user out of nowhere.
- **Commit:** `d15a63f`.

**3. [Rule 3 — blocking] `decorateField` silently clobbered the §7 item 13 hint.**
- It builds `aria-describedby` fresh and sets it unconditionally, so the arm's hint vanished the
  moment the field also carried `help`/`error`. Now it **seeds** from the attribute the arm wired
  (safe: the control is fresh each render, so nothing accumulates). Two 21-03 tests asserting exact
  `aria-describedby` equality were updated to `toContain` — the hint legitimately shares that slot.

**4. [Scope] Files touched beyond `files_modified`.**
- `src/index.ts` (**TSDoc only** — OPEN-5's wart, which 21-03 explicitly deferred here; no code, and
  `check:core-globals` still passes) and `styles/default.css` (`.vms-field__live` — the
  visually-hidden clip; without it the live regions and the hint render as visible page text).
  Deliberately **not** `display:none`/`visibility:hidden`: both remove the element from the
  accessibility tree, which would silently un-announce the very region this plan exists to build.

## 🚩 Flags — where the plan or the locked design turned out wrong

**1. 🚨 The orchestrator's brief and the PLAN disagree about scope, and I followed the PLAN.** The
brief instructed me to script the four adversarial interleavings ("FAIL-before / PASS-after") and to
settle **OPEN-4**. **The plan explicitly forbids both**: *"⚠️ The debounce CADENCE is this plan's
job; the four adversarial interleaving RACES are Plan 21-05's. Do not conflate them."* `21-05-PLAN.md`
exists, is `wave: 4`, `depends_on: [21-04]`, its sole `files_modified` is
`test/lookup-search-races.test.ts`, and its `must_haves` own **both** the four races and OPEN-4.
Writing them here would have collided with 21-05's file and left it with nothing to do. **The races
are NOT done and this plan's green says nothing about the interleaving** — 21-05 is still required,
exactly as the design intends. `test/lookup-search-dispatch.test.ts`'s header says so in the file so
its greenness can't be mistaken for race coverage.

**2. Two Rule-2 gaps mean the plan's task list was not sufficient to produce a usable control.**
Popup-open (flag 1 of 21-03) and first-search-results-invisible are both *load-bearing for the
primary flow* and neither was in any plan. The pattern is the same in both: **the cadence this plan
adds is what makes previously-invisible DOM-local state a bug.** Worth noting for 21-05/21-08 — the
chips layer is DOM-local too.

**3. `data-vms-lookup-key` now carries two facts (`hidden` + `querying`).** The snapshot walks the
popup element for both. If a future plan adds a third piece of DOM-local lookup state, it should
join that snapshot rather than grow a fourth mechanism — the same warning `chartInstances` carries.

**4. PATTERNS.md's "fake timers + deferred fetch has no analog" warning did NOT bite this plan.**
This suite needs fake timers only (no fetch — the adapter is driven directly with an `onAction`
spy). **That sharp edge is entirely 21-05's**, and it is still unproven. 21-05 must confirm its
harness can actually fail before trusting a green.

## Threat Flags

None. No new network surface, auth path, file access, or schema change. T-21-14 (the busy-lock) is
mitigated and asserted for both app-declared polarities; T-21-15 (a parallel staleness mechanism) is
grep-verified absent; T-21-16/T-21-17 (the silent live region; no loading signal) are each covered
by named tests, the D9 mutation proof, and the persistent-category comment.

## Known Stubs

None new. `lookup-multiple` still renders no chips (21-05's seam, unchanged by this plan).

## Self-Check: PASSED

- `viewmodel-shell/src/browser.ts` — FOUND (`blocking: false`, `liveRegions`, `lookupKeysSeen`)
- `viewmodel-shell/test/lookup-search-dispatch.test.ts` — FOUND (18 tests)
- `viewmodel-shell/test/lookup-live-region.test.ts` — FOUND (`toBe(first)` present, 23 tests)
- `viewmodel-shell/styles/default.css` — FOUND (`.vms-field__live`)
- commit `34f9747` — FOUND
- commit `d15a63f` — FOUND
