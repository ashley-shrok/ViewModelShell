---
phase: 31-textnode-maxlines-axis-closed-enum-line-cap-primitive-route-
plan: 03
subsystem: parity
tags: [parity, feature-probe, textnode, maxLines, expectBodyContains, findNulls, gotcha-9-class-3, gotcha-8-class-2]
requires:
  - "Plan 31-01 — TS wire `maxLines?: 1 | 2 | 3` on `TextNode` + BrowserAdapter class emission (shipped)"
  - "Plan 31-02 — .NET wire `int? MaxLines` init-only property on `TextNode` with `[JsonIgnore(WhenWritingNull)]` (shipped)"
  - "AGENTS.md gotcha #9 class-3 — 'branches the fixture never runs are invisible to the byte-diff'"
  - "AGENTS.md gotcha #8 class-2 — 'parity/normalize.ts scrubs `\"field\":null` BEFORE diffing; findNulls runs on raw parsed body per response'"
provides:
  - "Cross-backend parity coverage for TextNode.maxLines across all 4 wire states (unset, 1, 2, 3)"
  - "byte-diff proof of identical wire emission between dotnet-probe (.NET), bun-probe (bun), and node-probe (Node.js)"
  - "expectBodyContains per-step tripwires (branch-ran positive assertions) — 7 unique substrings total"
  - "findNulls always-on invariant coverage for the WhenWritingNull contract on TextNode.MaxLines"
  - "FeatureProbe `TextNodeMaxLinesProbe` state slot + 4 action arms + BuildVm section (both backends, byte-parallel)"
affects:
  - "parity/fixtures/textnode-maxlines.json (NEW — 4-step fixture)"
  - "parity/backends.json (3 FeatureProbe backend `fixtures` arrays extended)"
  - "demo/FeatureProbe/AspNetCore/FeatureProbeController.cs (state + arms + BuildVm section)"
  - "demo/FeatureProbe-bun/handler.ts (byte-parallel: state + arms + buildVm section)"
tech-stack:
  added: []
  patterns:
    - "Sequential-step-with-cumulative-state parity fixture (byte-parallel with chat-composer.json posture)"
    - "Empty-string sentinel `\"\"` for state slot with `unset` semantic (matches ChatComposerStatus/DropScope/SubmitMode posture — sidesteps gotcha #8 nullable-state footgun)"
    - "Conditional spread on the bun side to keep `maxLines` ABSENT (never `null`) when unset (gotcha #8 wire posture)"
    - "Object-initializer syntax `{ MaxLines = ... }` on the .NET side (MaxLines is init-only property outside primary ctor per Plan 31-02's binary-compat rationale)"
    - "Two-axis tripwire per branch: (a) marker text `TextNodeMaxLinesProbe={value}` proves branch RAN; (b) wire literal `\"maxLines\":N` proves axis emitted correctly (both together mutation-proof)"
key-files:
  created:
    - parity/fixtures/textnode-maxlines.json
  modified:
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - demo/FeatureProbe-bun/handler.ts
    - parity/backends.json
decisions:
  - "Followed 31-03-PLAN.md verbatim: Option B (empty-string sentinel) for state slot — matches existing FeatureProbe posture where ALL slots are non-nullable with empty/false defaults (verified via grep of the state record)"
  - "Each POST step has a UNIQUE two-substring assertion (marker text + wire literal); the GET step has a single-substring assertion (marker only — maxLines ABSENT for unset means no wire literal to assert positively; findNulls invariant catches the class-2 regression instead)"
  - "Fixture registered on all 3 FeatureProbe backends (not just one) so drift between any pair fails the byte-diff — the node-probe reuses the bun handler.ts, so a single edit satisfies both bun-probe AND node-probe; the .NET twin is the parity peer"
metrics:
  duration: "~15min"
  completed: "2026-08-03"
  files_created: 1
  files_modified: 3
  tasks: 2
requirements-completed: [MAXLINES-PARITY]
---

# Phase 31 Plan 03: TextNode.maxLines parity coverage Summary

**Cross-backend parity coverage for `TextNode.maxLines`: a 4-step fixture exercising unset + 1 + 2 + 3, byte-diffed across dotnet-probe (5011), bun-probe (5012), and node-probe (5013), with `expectBodyContains` tripwires per step per AGENTS.md gotcha #9 class-3 lesson. Ships the two-backend-parity gate that structurally proves the two backends (.NET and TS) emit identical wire for the axis; the always-on findNulls invariant (parity/run.ts) rides alongside to catch the class-2 gotcha #8 regression that normalize.ts scrubs BEFORE the byte-diff.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-08-03
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 3 (FeatureProbeController.cs, handler.ts, backends.json)
- **Files created:** 1 (textnode-maxlines.json)

## Accomplishments

### Task 1: FeatureProbe backends carry the maxLines probe

Byte-parallel edits to `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` and `demo/FeatureProbe-bun/handler.ts`:

- **State slot** — added `string TextNodeMaxLinesProbe` (.NET) / `textNodeMaxLinesProbe: string` (bun) with `""` (unset) default. Non-nullable per the existing FeatureProbe posture (ALL slots on the state record are non-nullable with empty/false defaults — verified via grep of the state record before writing). Empty-string sentinel sidesteps gotcha #8 (state records are app-owned; a nullable would need explicit `JsonIgnore` on the state record itself).

- **Initial() / initialState()** — set the new slot to `""` (unset branch).

- **4 action arms** — appended after the chat-composer arms and before the final `UnknownActionException` / `UnknownActionError`:
  - `textnode-maxlines-unset` → `""` (idempotent reset)
  - `textnode-maxlines-1` → `"1"`
  - `textnode-maxlines-2` → `"2"`
  - `textnode-maxlines-3` → `"3"`
  Each arm does `state = state with { ... }` (.NET) / `state = { ...state, ... }` (bun).

- **BuildVm section** — appended a new `SectionNode("Phase 31 TextNode.maxLines probe", Variant: Card)` after the ChatComposer probe section and BEFORE the ModalNode append. Renders a single `TextNode` whose:
  - **Value** carries a UNIQUE marker per state: `TextNodeMaxLinesProbe=unset|1|2|3`
  - **MaxLines** emits the wire literal `"maxLines":N` for N∈{1,2,3}, or is ABSENT for unset.

  The two-axis output pattern is what mutation-proofs the parity fixture's tripwires: the marker text confirms the branch RAN (per gotcha #9 class-3), the wire literal confirms the axis emitted correctly, and the always-on findNulls invariant (per gotcha #8 class-2) catches any `"maxLines":null` regression the byte-diff can't see.

- **.NET construction uses object-initializer syntax** `{ MaxLines = ... }` per Plan 31-02's rationale: MaxLines is an init-only property OUTSIDE the primary ctor (positional-append would break Markdown 0.2.x's packed IL per the companion binary-compat gate). Positional `MaxLines: N` does not compile.

- **bun construction uses conditional spread** so `maxLines` is ABSENT when unset (never `null`). Direct `undefined` assignment can leak `null` onto the wire on some serializers; the spread pattern is the standing precedent (see ChatComposerNode above it, or tableWindow's nameCol spread earlier in the file).

### Task 2: parity fixture + backends.json registration

- **`parity/fixtures/textnode-maxlines.json`** (NEW) — 4 sequential steps, byte-parallel with `chat-composer.json` posture:
  1. `unset-initial` (GET) → asserts `TextNodeMaxLinesProbe=unset`
  2. `maxlines-1` (POST) → asserts `TextNodeMaxLinesProbe=1` AND `"maxLines":1`
  3. `maxlines-2` (POST) → asserts `TextNodeMaxLinesProbe=2` AND `"maxLines":2`
  4. `maxlines-3` (POST) → asserts `TextNodeMaxLinesProbe=3` AND `"maxLines":3`

  Root `$comment` paragraph documents (a) fixture purpose (parity coverage for TextNode.maxLines across all 4 states); (b) why each branch has a UNIQUE tripwire per gotcha #9 class-3 lesson; (c) how the marker text doubles as the branch-ran positive assertion + how findNulls catches the class-2 gotcha #8 regression the byte-diff normalize scrubs; (d) why byte-parallel with chat-composer.json posture is intentional. Per-step `$comment` fields explain each branch's specific defense.

- **`parity/backends.json`** — appended `"textnode-maxlines"` to the `fixtures` array on all 3 FeatureProbe backends (dotnet-probe, bun-probe, node-probe). The node-probe reuses `handler.ts` from the bun-probe (per the existing `demo/FeatureProbe-bun/server-node.ts` shape), so a SINGLE bun edit covers BOTH bun-probe AND node-probe; the .NET twin is the third parity peer.

## Task Commits

| Hash | Message |
|------|---------|
| `a8492cb` | feat(31-03): FeatureProbe TextNode.maxLines probe state slot + BuildVm (both backends) |
| `22df6f4` | feat(31-03): parity fixture textnode-maxlines + register on 3 FeatureProbe backends |

## Verify — Command Output

### Task 1 verify: `dotnet build demo/FeatureProbe/AspNetCore`

```
$ export PATH="$HOME/.dotnet:$PATH" && dotnet build demo/FeatureProbe/AspNetCore --nologo -v minimal /p:SkipFrontendBuild=true
  Restored .../FeatureProbe.csproj (in 52 ms).
  Restored .../AshleyShrok.ViewModelShell.csproj (in 84 ms).
  AshleyShrok.ViewModelShell -> .../AshleyShrok.ViewModelShell.dll
  FeatureProbe -> .../FeatureProbe.dll

Build succeeded.
    0 Warning(s)
    0 Error(s)
```

### Task 1 verify: bun handler type-check

```
$ cd demo/FeatureProbe-bun && ./node_modules/.bin/tsc --noEmit -p tsconfig.json
(no output — exit 0)
```

Also manually checked `handler.ts` with the tsconfig options passed inline (standalone check) — 0 errors.

### Task 1 acceptance-criterion greps

```
$ grep -c "TextNodeMaxLinesProbe" demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
9        # >= 6 acceptance floor ✓
$ grep -c "textNodeMaxLinesProbe" demo/FeatureProbe-bun/handler.ts
12       # >= 6 acceptance floor ✓
```

### Task 2 verify: `bun run parity/run.ts`

Relevant tail (grep filtered for readability; the harness prints every backend's every step; here I show the fixture registrations, step counts, agreement, and final result):

```
$ export PATH="$HOME/.dotnet:$PATH" && bun run parity/run.ts 2>&1 | grep -E "textnode-maxlines|Fixture:|steps captured|backends agree|Parity"
Parity harness — 17 backends
  dotnet-tasks: 8 steps captured
  bun-tasks: 8 steps captured
  ✓ all backends agree
  ...
  dotnet-probe: 41 steps captured
  bun-probe: 41 steps captured
  node-probe: 41 steps captured
  ✓ all backends agree
  dotnet-probe: 6 steps captured
  bun-probe: 6 steps captured
  node-probe: 6 steps captured
  ✓ all backends agree
  dotnet-probe: 5 steps captured
  bun-probe: 5 steps captured
  node-probe: 5 steps captured
  ✓ all backends agree
Fixture 'textnode-maxlines' across 3 backends:
  dotnet-probe: 4 steps captured
  bun-probe: 4 steps captured
  node-probe: 4 steps captured
  ✓ all backends agree
  ...
✓ Parity tests passed
```

The new fixture ran against all 3 FeatureProbe backends (each captured 4 steps) and the byte-diff confirmed all backends agree. No `findNulls` warnings fired on any backend's responses for the new fixture, and no `expectBodyContains` tripwires failed.

### Task 2 acceptance-criterion greps

```
$ jq '.name' parity/fixtures/textnode-maxlines.json
"textnode-maxlines"      ✓
$ jq '.steps | length' parity/fixtures/textnode-maxlines.json
4                         ✓
$ grep -c "textnode-maxlines" parity/backends.json
3                         ✓ (registered on all 3 FeatureProbe backends)
```

### Manual smoke test — .NET side

To visually confirm the wire output shape before trusting the parity harness's agreement, ran a spot-check against the .NET probe on port 5099:

```
$ dotnet run --no-build --urls http://localhost:5099 &  # from demo/FeatureProbe/AspNetCore
$ curl -s http://localhost:5099/api/probe | python3 <check>
MARKER FOUND: unset
OK: maxLines key absent (as expected)     # gotcha #8 posture — findNulls invariant covers

$ curl -s -X POST http://localhost:5099/api/probe/action \
    -F "_action={\"name\":\"textnode-maxlines-1\"}" \
    -F "_state=$INITIAL_STATE" | python3 <check>
MARKER FOUND: 1
WIRE FOUND: maxLines=1                     # closed-enum wire value exactly as expected
```

Both branches emit exactly what the fixture asserts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Restored missing `viewmodel-shell/node_modules` via `npm install`**

- **Found during:** Task 2 verify (first `bun run parity/run.ts` invocation)
- **Issue:** parity harness's prebuild step (`dotnet build demo/Tasks/AspNetCore`) invoked `npm run build` in `demo/Tasks/frontend/`, which failed with `[vite]: Rollup failed to resolve import "@tiptap/core" from ".../viewmodel-shell/src/browser.ts"`. Root cause: `viewmodel-shell/node_modules/` was absent in this worktree at spawn time (identical to the situation Plan 31-01 documented in its SUMMARY).
- **Fix:** `cd viewmodel-shell && npm install` — populated node_modules matching the shipped lockfile shape. `@tiptap/core` present after install.
- **Files modified:** none (install-time work only; the resulting `viewmodel-shell/package-lock.json` had a pre-existing `9.0.0` vs `package.json`'s `9.1.1` stamp drift documented in Plan 31-01 SUMMARY — left unstaged per SCOPE BOUNDARY, not caused by this plan's changes)
- **Commit:** N/A (environmental restore, not source change)

### Deferred Issues (out-of-scope discoveries)

**1. Pre-existing `viewmodel-shell/package-lock.json` version-stamp drift (`9.0.0` vs `9.1.1`)**

- Same drift Plan 31-01 documented in its SUMMARY. It belongs to the Phase 30 v9.1.0/v9.1.1 release ritual reconciliation, not to this plan.
- Logged here for continued visibility to the next release-ritual agent (Plan 31-04); NOT staged in this plan's commits.

**2. Pre-existing NPM install advisory ("9 vulnerabilities … 2 critical") on `npm install`**

- Standard `npm audit` output during the install-time restore above.
- Orthogonal to this plan; not caused by any file this plan touched.

## Authentication Gates

**None** — the plan is pure fixture + demo-backend wiring, no external services, no auth.

## Threat Register Coverage

Per PLAN.md `<threat_model>`:

| Threat ID | Category | Coverage |
|-----------|----------|----------|
| T-31-03-01 | Tampering | **Mitigated (dual-layer)** — marker text `TextNodeMaxLinesProbe={value}` is a distinctive Pascal-case identifier that appears NOWHERE else in the FeatureProbe wire (grep-verified during smoke test); the `"maxLines":N` wire literal is ALSO distinctive because no other TextNode in the FeatureProbe fixture sets a MaxLines value. Both defense layers together make the assertion mutation-proof. |
| T-31-03-02 | Denial of service | **Accepted (inherited)** — same posture as every other parity fixture; the harness's own timeouts + PATH-export gate handle backend startup failure. |
| T-31-03-03 | Information disclosure | **Accepted (public)** — the parity fixture is a public artifact; state slot names are already public via source. No secret in the fixture. |
| T-31-03-04 | Repudiation | **Mitigated** — each step's `$comment` explicitly names the branch + defense discipline; a failing run's output includes the step ID (`unset-initial` / `maxlines-1` / etc.) so the failure locus is unambiguous. |

## Threat Flags

None. This plan adds a parity fixture + FeatureProbe state slot + BuildVm section — no new network endpoints, no auth surface, no file access, no schema changes at trust boundaries.

## Known Stubs

None. No placeholder text, no hardcoded empty values, no unwired data sources. The marker text is a first-class emitted string (the intended UNIQUE tripwire), not a "TODO" stub. The state slot's `""` empty-string default IS the "unset" branch — semantically meaningful (matches the fixture's `unset-initial` step).

## Self-Check: PASSED

- `parity/fixtures/textnode-maxlines.json` present with 4-step structure ✓
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — `grep -c TextNodeMaxLinesProbe` = 9 ✓
- `demo/FeatureProbe-bun/handler.ts` — `grep -c textNodeMaxLinesProbe` = 12 ✓
- `grep -c "textnode-maxlines" parity/backends.json` = 3 ✓
- `dotnet build demo/FeatureProbe/AspNetCore` — 0 warnings, 0 errors ✓
- `tsc --noEmit -p tsconfig.json` (FeatureProbe-bun) — 0 errors ✓
- `bun run parity/run.ts` — exits 0, all 17 backends agree, new fixture ran on all 3 FeatureProbe backends with 4 steps captured each, no findNulls warnings ✓
- Manual smoke test — .NET side emits the expected marker + wire literal / omission per branch ✓
- Commits present in git log:
  - `a8492cb` (Task 1) ✓
  - `22df6f4` (Task 2) ✓

## Next Phase Readiness

- **Plan 31-04 (release ritual, Wave 3)** — ready to run. Bumps package versions (npm 9.2.0 + NuGet 9.2.0 — minor), CHANGELOG entry, MIGRATION note, publishes to registries, tags, advances main. The green-tree gate at publish time (per AGENTS.md Working agreement) MUST resolve the pre-existing `viewmodel-shell/node_modules`-must-be-populated environmental issue (Plan 31-01 + Plan 31-02 + this plan all flagged it) — either by ensuring the release worktree runs `npm install` in `viewmodel-shell/` before parity, or by promoting `@tiptap/core` to demo devDeps (the cleaner long-term fix).

## Handoff — Wave 2 to Wave 3

The parity fixture makes the two-backend axis coverage LOAD-BEARING for any future refactor of TextNode.MaxLines:

- A mutation that stops emitting `"maxLines":N` on either backend fails the byte-diff (structural parity gate)
- A mutation that stops running any of the 4 branches fails the corresponding expectBodyContains tripwire (class-3 gotcha #9 defense)
- A mutation that starts emitting `"maxLines":null` (either backend, either the ViewNode types' intrinsic `[JsonIgnore]` or the state record's own serialization) fails findNulls (class-2 gotcha #8 defense — the diff's normalize scrubs `null` BEFORE comparing, so findNulls is the ONLY invariant that catches this class)

Plan 31-04 (release ritual) can rely on the parity fixture as the wave-2 gate that the axis serializes correctly. The v9.2.0 CHANGELOG entry can name this fixture as the "cross-backend proof of identical wire".

---
*Phase: 31-textnode-maxlines-axis-closed-enum-line-cap-primitive-route-*
*Completed: 2026-08-03*
