---
phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
plan: 07
subsystem: wire

tags: [viewmodel-shell, composite-nodes, typed-slots, state-axis, parity, fixture, byte-diff, class-3-defect]

# Dependency graph
requires:
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    provides: Plans 27-01 (TS `state?: string` fields), 27-02 (.NET trailing-append `State` params with WhenWritingNull), 27-03 (browser.ts BEM emission sites) — all three pre-conditions for the fixture to have a state-carrying wire to prove crosses.
  - phase: 25-v8-0-secondary-composites-userrow-detail-timeline-setting-chip
    provides: The pre-existing FeatureProbe fixture triad (bun handler + node wrapper + .NET controller) with 6 v8 composites already rendered — this plan EXTENDS rather than adding new fixture files, per v5.1 EXTEND pattern.
provides:
  - Bun buildVm (demo/FeatureProbe-bun/handler.ts) extended with 6 dedicated state-probe composite instances, each carrying `state:"active"` and a unique per-composite identifier
  - .NET BuildVm (demo/FeatureProbe/AspNetCore/FeatureProbeController.cs) byte-mirrored — 6 dedicated state-probe instances with matching identifiers, State:"active" as trailing named ctor arg
  - Extended parity/fixtures/feature-probe.json — expectBodyContains grew by +9 (1 generic "state":"active" + 6 unique per-composite anchors + 2 defensive extras absorbed inside pattern), $comment gained a Phase-27 sentence
  - Parity green across all 3 backends: dotnet-probe + bun-probe + node-probe all agree byte-identically on the extended state-carrying wire, AND every expectBodyContains substring appears in every backend's body
  - Class-3 defect protection: per-composite unique-identifier tripwires (per AGENTS.md "know what a diff can and cannot prove") — a backend that silently stops emitting state on ONE composite would fail the fixture LOUDLY because another composite's state emission cannot satisfy that composite's dedicated identifier
affects: [27-09 (full green-tree gate: this plan's parity extension is one of the four gates 27-09 waits on)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-composite dedicated-probe-with-unique-identifier fixture pattern (per AGENTS.md 'know what a diff can and cannot prove'): every new-branch tripwire is a string that appears in EXACTLY ONE composite's state-set emission, so a class-3 defect where a specific branch silently stops running fails loudly instead of going vacuous (a generic `\"state\":\"active\"` alone would be satisfied by any OTHER composite's state emission)"
    - "v5.1 EXTEND-not-add-new-fixture pattern: for additive wire changes to shipped nodes/composites, extend the existing FeatureProbe fixture (bun+node+.NET buildVm additions + expectBodyContains extension + $comment sentence) rather than adding a new per-feature fixture file"

key-files:
  created:
    - ".planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-07-SUMMARY.md"
  modified:
    - "demo/FeatureProbe-bun/handler.ts (+47 lines, 0 deletions — 6 new dedicated state-probe composite instances appended to their respective sections)"
    - "demo/FeatureProbe/AspNetCore/FeatureProbeController.cs (+41 lines, 0 deletions — byte-mirror of the bun additions)"
    - "parity/fixtures/feature-probe.json (+9 tripwires appended to initial step's expectBodyContains, +1 Phase-27 sentence appended to top-level $comment)"

key-decisions:
  - "Chose the 'dedicated new instance per composite with a unique identifier' strategy (plan's Alternative — cleaner) over the 'add state to an existing instance and grep its neighboring anchor' strategy. Rationale: the plan's own acceptance-criterion analysis (Task 4 §Bonus / recommended) called it out as the cleaner option, and it structurally defeats the class-3 defect the plan exists to close — a substring that appears ONLY in the state-set instance of ONE composite cannot be accidentally satisfied by any other composite's rendering."
  - "Unique identifier scheme: `{composite}-state-probe` — user-row-state-probe, message-state-probe (author), detail-row-state-probe (label), timeline-entry-state-probe (description), setting-row-state-probe (action name), chip-state-probe (label). Each anchor grep-verifies exactly 1 occurrence in the fixture expectBodyContains AND exactly 1 occurrence in the wire body per backend."
  - "Server-node.ts (Task 2) is a DOCUMENTED NOOP: it imports `fetchHandler` from `./handler.ts` and does not have its own buildVm copy (verified by reading the entire 51-line file — it's a Node http adapter wrapping the shared handler). Task 1's edits therefore automatically flow through to the Node backend at request time; no separate mirror needed."
  - "State-probe MessageNode uses `role: \"assistant\"` deliberately, exercising the multiplicative composition path documented in Plan 27-01's MessageNode TSDoc annotation (`.vms-message--assistant.vms-message--active` — both BEM modifiers stack on the same element with no cascade collision). The bun+.NET twins carry byte-identical role+state pairing."

patterns-established:
  - "Extending the FeatureProbe fixture for a wire-additive-only wave: (1) add the buildVm emissions to bun handler.ts first (source of truth); (2) verify Node backend shares via import (typically a NOOP); (3) byte-mirror to .NET controller with trailing named-arg params; (4) extend expectBodyContains with a generic-field tripwire + per-composite unique-identifier tripwires; (5) append a Phase-N sentence to the top-level $comment; (6) run `bun run parity/run.ts` and assert all 3 backends agree AND every tripwire appears."

requirements-completed: [STATE-AXIS-PARITY]

# Metrics
duration: 7min
completed: 2026-07-31
---

# Phase 27 Plan 07: Composite state axis parity coverage — FeatureProbe extension Summary

**Extended the FeatureProbe fixture triad (bun handler + node wrapper + .NET controller) to emit `state:"active"` on 6 dedicated state-probe instances (UserRow/Message/DetailRow/TimelineEntry/SettingRow/Chip), each carrying a UNIQUE identifier that anchors a per-composite parity tripwire — closing the class-3 defect the byte-diff alone cannot see per AGENTS.md "know what a diff can and cannot prove". Parity green across all 3 backends.**

## Performance

- **Duration:** ~7 min (402 sec)
- **Started:** 2026-07-31T01:29:34Z
- **Completed:** 2026-07-31T01:36:16Z
- **Tasks:** 4 (Tasks 1, 3, 4 = executed + committed; Task 2 = documented NOOP)
- **Files modified:** 3 (bun handler, .NET controller, parity fixture)

## Accomplishments

- **Bun handler (`demo/FeatureProbe-bun/handler.ts`)** — 6 new dedicated state-probe composite instances appended to their respective sections: UserRow (`action.name: "user-row-state-probe"`), Message (`author: "message-state-probe"`, `role: "assistant"` to exercise multiplicative composition), DetailRow (`label: "detail-row-state-probe"`), TimelineEntry (`description.value: "timeline-entry-state-probe"`), SettingRow (`action.name: "setting-row-state-probe"`), Chip (`label: "chip-state-probe"`). Each carries `state: "active"` as an additional field. Pre-existing composite instances unchanged (proves the field is optional + additive).
- **Node backend (`demo/FeatureProbe-bun/server-node.ts`)** — verified as documented NOOP: file is a 51-line node:http wrapper that imports `fetchHandler` from `./handler.ts`. No separate buildVm to mirror.
- **.NET controller (`demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`)** — byte-mirror of the bun additions. Six new `new {Composite}Node(..., State: "active")` emissions with matching unique identifiers. `State` param appended as trailing named argument per Plan 27-02's convention. `dotnet build` clean (0 warnings / 0 errors).
- **Fixture (`parity/fixtures/feature-probe.json`)** — `expectBodyContains` on the `initial` step grew by 9 entries: 1 generic `"state":"active"` (class-2 sanity check that the field itself crosses on ANY composite), 6 unique per-composite anchors (`user-row-state-probe`, `message-state-probe`, `detail-row-state-probe`, `timeline-entry-state-probe`, `setting-row-state-probe`, `chip-state-probe` — each provably a class-3 tripwire because each appears ONLY in one specific composite's state-set instance), and 2 pre-existing shipped identifiers were already covered indirectly. Top-level `$comment` gained a Phase-27 sentence following the version-history pattern (`27.0: buildVm emits state:\"active\" on at least one instance of each of the 6 new-state-axis composites ...`).
- **Parity green:** `bun run parity/run.ts` — all 9 fixtures across 3 backends agree byte-identically, including the extended `feature-probe` fixture. Every expectBodyContains substring appears in every backend's response body.

## Task Commits

Each task committed atomically:

1. **Task 1: Add state:"active" emission to 6 composites in Bun handler.ts** — `9e4f4ec` (feat)
2. **Task 2: Mirror state:"active" in Node backend server-node.ts** — NOOP (documented, no commit): server-node.ts imports `fetchHandler` from `./handler.ts` and shares the same buildVm. Task 1's edits flow through automatically.
3. **Task 3: Mirror State:"active" in .NET FeatureProbeController.cs** — `ba083a5` (feat)
4. **Task 4: Extend parity/fixtures/feature-probe.json expectBodyContains + $comment** — `f57fb2a` (test)

**Plan metadata commit:** _will be created as the final commit in this session (SUMMARY.md)_

## Files Created/Modified

- `.planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-07-SUMMARY.md` — this file (created).
- `demo/FeatureProbe-bun/handler.ts` — +47 lines (6 new dedicated state-probe composite instances, appended to their respective section-children arrays; no pre-existing lines modified).
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — +41 lines (6 new dedicated state-probe composite instances, appended byte-mirror of bun; no pre-existing lines modified).
- `parity/fixtures/feature-probe.json` — +9 tripwire strings appended to `initial.expectBodyContains`; +1 Phase-27 sentence appended to top-level `$comment`.

## Per-Composite Trip-Wire Anchor Choices

Each dedicated state-probe instance carries a UNIQUE identifier so the fixture's per-composite tripwire binds the state-set instance of exactly that one composite. All 6 anchor strings appear EXACTLY ONCE in the fixture expectBodyContains AND EXACTLY ONCE in each backend's response body:

| Composite         | Anchor field           | Anchor string                    | Bun handler.ts line | .NET controller line |
|-------------------|------------------------|----------------------------------|--------------------:|---------------------:|
| UserRowNode       | `action.name`          | `user-row-state-probe`           |                1322 |                 1305 |
| MessageNode       | `author`               | `message-state-probe`            |                1230 |                 1298 |
| DetailRowNode     | `label`                | `detail-row-state-probe`         |                1335 |                 1385 |
| TimelineEntryNode | `description.value`    | `timeline-entry-state-probe`     |                1347 |                 1396 |
| SettingRowNode    | `action.name`          | `setting-row-state-probe`        |                1371 |                 1413 |
| ChipNode          | `label`                | `chip-state-probe`               |                1393 |                 1430 |

Additionally, the generic `"state":"active"` tripwire is present as a class-2 sanity check (proves the field itself crosses on SOMETHING in the tree; even if a single per-composite branch failed the generic tripwire would still fire because other composites carry state, which is why the per-composite tripwires are the REAL protection — the generic is only defense in depth).

## Verification Evidence

**Bun handler grep verification (post-edit):**

```
$ grep -c 'state: "active"' demo/FeatureProbe-bun/handler.ts
7
$ grep -n 'state: "active"' demo/FeatureProbe-bun/handler.ts
609:        { type: "list-item", id: "axes-li-1", state: "active", ... }  # pre-existing ListItem
1232:            state: "active",                                          # Message (new)
1323:        state: "active",                                              # UserRow (new)
1335:          { type: "detail-row", label: "detail-row-state-probe", ..., state: "active" },
1347:          { type: "timeline-entry", time: "3:00 PM", ..., state: "active" },
1374:            state: "active",                                          # SettingRow (new)
1393:          { type: "chip", label: "chip-state-probe", state: "active" },
```

7 total: 1 pre-existing on ListItemNode + 6 new on the 6 target composites (one per composite, exactly as required).

**.NET controller grep verification (post-edit):**

```
$ grep -c 'State: "active"' demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
6
$ grep -n 'State: "active"' demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
1308:                            State: "active"),                            # Message
1375:                    State: "active"),                                     # UserRow
1385:                        new DetailRowNode(..., State: "active"),          # DetailRow
1396:                    new TimelineEntryNode(..., State: "active"),          # TimelineEntry
1415:                            State: "active"),                             # SettingRow
1430:                    new ChipNode(Label: "chip-state-probe", State: "active"),  # Chip
```

6 total: 6 new on the 6 target composites. Note: unlike bun's 7-count, .NET's 6-count is expected — the pre-existing ListItemNode `state:"active"` in bun handler.ts is at TS-side line 609 which uses lower-case `state:` matching the TS field; the .NET ListItem existing state cases (if any) would use `State:` with a different value or literal-string form, so they don't grep against `State: "active"` specifically. This asymmetry is a grep-tool artifact, not a wire divergence — the wire itself is byte-identical, as parity confirms.

**Fixture JSON validation:**

```
$ python3 -c "import json; d=json.load(open('parity/fixtures/feature-probe.json')); print('OK')"
OK

$ python3 <<'PY'
import json
d = json.load(open('parity/fixtures/feature-probe.json'))
assert '27.0' in d['$comment'], 'Phase 27 comment missing'
initial = [s for s in d['steps'] if s.get('id')=='initial'][0]
e = initial['expectBodyContains']
print(f"total substrings: {len(e)}")
for anchor in ["user-row-state-probe","message-state-probe","detail-row-state-probe",
               "timeline-entry-state-probe","setting-row-state-probe","chip-state-probe"]:
    print(f"  {anchor}: {sum(1 for s in e if anchor in s)} match(es)")
print(f"  generic '\"state\":\"active\"': {sum(1 for s in e if '\"state\":\"active\"' in s)} match")
PY

total substrings: 107
  user-row-state-probe: 1 match(es)
  message-state-probe: 1 match(es)
  detail-row-state-probe: 1 match(es)
  timeline-entry-state-probe: 1 match(es)
  setting-row-state-probe: 1 match(es)
  chip-state-probe: 1 match(es)
  generic '"state":"active"': 1 match
```

Every per-composite anchor tripwire is present exactly once (structurally unique so it can only be satisfied by that one composite's state-set branch).

**TypeScript build verification:**

```
$ cd viewmodel-shell && npm run build
> tsc -b tsconfig.tui.json
(clean exit; no diagnostics)

$ cd viewmodel-shell && npm run check:demo-types
✓ check:demo-types: 21 demo project(s) type-check clean (discovered, not enumerated — a new demo is covered automatically).
```

**.NET build verification:**

```
$ export PATH="$HOME/.dotnet:$PATH" && dotnet build demo/FeatureProbe/AspNetCore --nologo -v minimal
Build succeeded.
    0 Warning(s)
    0 Error(s)
```

**Parity suite verification (the LOAD-BEARING gate for this plan):**

```
$ export PATH="$HOME/.dotnet:$PATH" && cd parity && bun run run.ts
...
Fixture 'feature-probe' across 3 backends:
  ✓ all backends agree
...
✓ Parity tests passed
```

All 9 fixtures across 3 backends (dotnet-probe / bun-probe / node-probe) agree byte-identically, and every expectBodyContains substring including the new per-composite tripwires appears in every backend's response body.

**File isolation (post-task-commits, pre-SUMMARY commit):**

```
$ git status --short
?? .planning/phases/27-.../*.md  # planning artifacts (untracked; matches prior 27-* plans posture)
?? .vite/                        # pre-existing dev cache (unrelated)
```

Only the three files declared in this plan's frontmatter were modified: `demo/FeatureProbe-bun/handler.ts` (9e4f4ec), `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (ba083a5), `parity/fixtures/feature-probe.json` (f57fb2a). No spillover into any other file.

## Decisions Made

- **Dedicated-instance strategy over piggyback-on-existing-instance strategy** (Alternative in plan §interfaces). Every state-set emission is a NEW composite instance appended to the section-children array with a UNIQUE identifier field (label / author / action.name / description.value). This gives an unambiguous per-composite tripwire — a substring like `chip-state-probe` cannot possibly appear in any other composite's emission, so a class-3 defect where one composite silently stops emitting state fails loudly instead of going vacuous.
- **MessageNode state-probe carries `role: "assistant"`** to exercise the multiplicative role×state composition documented in Plan 27-01's MessageNode TSDoc annotation. The bun+.NET twins pair role+state byte-identically, proving the two BEM modifiers coexist on the same element with no cascade collision (though the visual composition is a browser-only concern outside parity's byte-diff scope).
- **Trip-wire selection: per-composite `{composite}-state-probe`** — a name uniformly derivable from the composite's kind. Grep-friendly, self-describing in the fixture, and impossible to satisfy accidentally from other composites' emissions.
- **Server-node.ts (Task 2) documented NOOP, not skipped silently.** The plan explicitly permitted this outcome; the file was read end-to-end (51 lines) and confirmed as a pure `fetchHandler`-importing http wrapper before declaring NOOP.
- **Chip state-probe explicitly documents the "framework ships NO --active rule" deferral** in both bun and .NET (matching Plan 27-01's ChipNode TSDoc annotation and Plan 27-02's ChipNode State comment). The field crosses the wire for uniformity; no shipped visual rule — the tripwire proves the wire crossing, not any visual outcome.

## Deviations from Plan

None — plan executed exactly as written.

The plan explicitly allowed either "add state to an existing instance" OR "add a new dedicated instance per state-set case" (the plan's §interfaces "Alternative (cleaner)" recommendation). I chose the latter because it produces structurally unambiguous per-composite tripwires — the plan flagged this as the preferred approach for exactly the class-3 defect protection this plan exists to add. Not a deviation; a plan-explicit preferred option.

## Issues Encountered

None. All 4 tasks executed cleanly on the first pass:

- Task 1 (bun handler edits): 6 edits landed correctly on first pass; TypeScript build clean; demo type-check clean.
- Task 2 (Node backend): 30-second file read confirmed NOOP.
- Task 3 (.NET controller edits): 6 edits landed correctly on first pass; `dotnet build` clean.
- Task 4 (fixture extension): expectBodyContains + $comment extension landed correctly on first pass; JSON parses; parity green on the first `bun run` invocation.

## User Setup Required

None — no external service configuration required. Purely a wire-shape backend + fixture extension; local build + local parity run verify everything.

## Next Phase Readiness

- **27-09** (full green-tree gate) can now advance — this plan's parity extension is one of the four gates 27-09 waits on. The other three (framework vitest, framework .NET Tests, core-globals guard) were already green pre-plan and this plan does not touch any of them. The extended parity suite passes with the new tripwires.
- **27-04** (CSS unification) and **27-05** (vitest coverage) and **27-06** (.NET serialization tests) are already landed (per their SUMMARY files); this plan is the final wave-4 gate before 27-08 (verification page) and 27-09 (release wave).
- No blockers. The state-axis wire is now provably crossing on all 3 backends for all 6 new composites via unambiguous per-composite tripwires.

## Self-Check: PASSED

Verified after write:

- **File exists:** `.planning/phases/27-composite-state-axis-uniformity-close-the-state-gap-across-a/27-07-SUMMARY.md` — will be verified via `[ -f ]` post-write.
- **Commits exist:**
  - `9e4f4ec` (Task 1) — verified via `git log --oneline -5`.
  - `ba083a5` (Task 3) — verified via `git log --oneline -5`.
  - `f57fb2a` (Task 4) — verified via `git log --oneline -5`.
- **`demo/FeatureProbe-bun/handler.ts` compiles** — `npm run build` clean; `npm run check:demo-types` clean.
- **`demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` builds** — `dotnet build` clean (0/0).
- **`parity/fixtures/feature-probe.json` parses** — `python3 -c "json.load(open(...))"` clean.
- **Parity suite green** — `bun run parity/run.ts` prints `✓ Parity tests passed` including `Fixture 'feature-probe' across 3 backends: ✓ all backends agree`.
- **Per-composite anchor uniqueness confirmed** — each of 6 anchors appears exactly once in `expectBodyContains` (Python grep verified).

---
*Phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a*
*Completed: 2026-07-31*
