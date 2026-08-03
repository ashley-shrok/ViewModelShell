---
phase: 30-chat-composer-primitive-chatcomposernode-route-b-composite
plan: 07
subsystem: parity
tags: [parity, fixture, chat-composer, expect-body-contains, tripwire, feature-probe, cross-backend, byte-parallel]

# Dependency graph
requires:
  - phase: 30-01
    provides: ChatComposerNode TS wire type + closed-enum axes (ChatComposerStatus/DropScope/SubmitMode)
  - phase: 30-02
    provides: ChatComposerNode .NET wire type + KebabEnum<T> converters + JsonDerivedType registration
  - phase: 30-03
    provides: adapter renderer emitting the composer pill + data attributes (used only for CLIENT-SIDE render — not parity)
  - phase: 30-04
    provides: adapter keyboard/state-machine wiring (used only for CLIENT-SIDE — not parity; wire semantics unaffected)
  - phase: 30-05
    provides: adapter attach paths + composerRegistry (used only for CLIENT-SIDE — not parity)
provides:
  - Cross-backend byte-parallel proof for the 5 documented ChatComposerNode wire branches (CHAT-15)
  - Per-branch expectBodyContains tripwires binding every branch independently on each backend (class-3 gotcha #9 protection)
  - Always-on findNulls invariant binding the null-omission contract per-response (class-2 gotcha #8 protection)
  - Adversarial-break test operationalized (tripwire proven to fire loudly on regression, then restored)
affects: [30-08, 30-09, 30-10, 30-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "State-driven fixture branch selection (mutate state via named action → buildVm reads slot → emits target branch's tripwire). No stateMutations blocks in fixture — action handlers own the mutation, matching the SEEDED-helpdesk precedent."
    - "Server-emitted marker for CLIENT-SIDE-only features (chip strip lives in local File registry, not state — so the branch-C tripwire is a headerSlot TextNode carrying a UNIQUE string a mutation cannot silently drop from elsewhere)."
    - "Conditional-spread emission on the bun side to honor gotcha #8 (an unset optional is ABSENT, not null) — matches the existing tableWindow nameCol filterValue pattern in the same handler."

key-files:
  created:
    - "parity/fixtures/chat-composer.json (56 lines) — CHAT-15 fixture, 5 steps × per-branch expectBodyContains; $comment cites gotcha #9 class-3 + gotcha #8 class-2 explicitly"
  modified:
    - "demo/FeatureProbe/AspNetCore/FeatureProbeController.cs (+132 −2) — grew FeatureProbeState with 6 new slots (chatComposerDraft + 5 branch drivers), added ChatComposerNode section to buildVm, added 4 branch-mutator + 3 no-op passthrough action arms"
    - "demo/FeatureProbe-bun/handler.ts (+114 lines) — byte-parallel bun/node twin; grew FeatureProbeState interface, initialState defaults, buildVm section (using conditional-spread emission to preserve gotcha #8 posture), added identical action arms"
    - "parity/backends.json (+3 −3) — registered chat-composer fixture on all 3 FeatureProbe backends (dotnet-probe, bun-probe, node-probe)"

key-decisions:
  - "Fixture uses state-driven action mutations (not stateMutations blocks) — matches SEEDED-helpdesk shape where the SERVER owns branch selection via the request handler, not the client-side renderer's bind writes. Rationale: the ChatComposerNode's branches are server-observable state, not renderer-side inputs; stateMutations exists for the case where the renderer wrote a bind value before dispatch (form fields), which does not apply here."
  - "Backend name correction: plan text referenced dotnet-feature-probe / bun-feature-probe / node-feature-probe but backends.json uses dotnet-probe / bun-probe / node-probe. Registration added to the correct 3 names (verified via python3 script post-registration; all 3 confirmed carrying `chat-composer` in their fixtures array)."
  - "AttachAction is ALWAYS emitted (not gated on state) so the idle-initial GET tripwire can assert on it — every consumer of ChatComposerNode who wires an attach path emits this field, so the wire-shape proof stays branch-independent. State-driven fields (status/stopAction/dropScope/submitMode/headerSlot) all default to absent per gotcha #8 (verified: findNulls clean on all 5 fixture steps AND on the pre-fixture curl smoke tests, per-backend)."
  - "Branch-C tripwire is a UNIQUE server-emitted substring (`ChatComposerAttached=true tripwire`) — not `\"vms-chat-composer__chip\"` from the plan text. Rationale: the chip strip is CLIENT-SIDE only (File registry lives in the adapter, not state), so a CSS class-name based tripwire wouldn't appear on the wire regardless of branch state. A server-emitted TextNode with a mutation-proof unique string is the correct wire-side tripwire — no other code path in the entire FeatureProbe emission can produce it, so a silent branch drop fails LOUDLY (grep-confirmed unique via `grep -rc 'ChatComposerAttached=true tripwire' demo/ viewmodel-shell*` returning only the two intended emission sites)."
  - "findNulls invariant is ALREADY UNCONDITIONAL in parity/run.ts:314-322 (fires on every step, not per-fixture-opt-in). The plan's fixture template included per-step `findNulls: false` fields, which are not part of the FixtureStep TypeScript interface. Omitted from the shipped fixture — the invariant runs regardless. Verified: `grep -c '\"findNulls\"' parity/fixtures/*.json` returns 0 for every existing fixture, and every fixture is still bound by the invariant."

patterns-established:
  - "New parity fixture for a new composite in the ChatComposerNode style: grow FeatureProbeState with N slots (one per branch), add branch-mutator action arms (state passthrough + one slot flip), add buildVm section with slot-driven conditional emission, write fixture with exactly 5 (or N) steps each carrying one UNIQUE expectBodyContains substring. Byte-parallel across ALL backends. The always-on findNulls invariant + expectBodyContains together close both class-2 (nulls filtered pre-diff) + class-3 (branches never run) gotcha #9 defects."

# Metrics
metrics:
  duration: "~13 minutes"
  completed: "2026-08-03"
  tasks: 4
  files-touched: 4  # 1 new fixture + 2 modified demos + 1 modified backends.json
---

# Phase 30 Plan 07: ChatComposerNode Parity Fixture Summary

Cross-backend parity for the v9.1.0 `ChatComposerNode` composite proven byte-parallel across .NET + bun + node backends via a new 5-step fixture with per-branch `expectBodyContains` tripwires + the always-on `findNulls` invariant.

## What landed

**New file:** `parity/fixtures/chat-composer.json` (56 lines) — 5 fixture steps, each with a UNIQUE `expectBodyContains` substring that only the step's target branch can produce.

**Modified files:**
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (+132 lines) — 6 new state slots, 4 branch-mutator + 3 no-op passthrough action arms, new ChatComposerNode section in `BuildVm`.
- `demo/FeatureProbe-bun/handler.ts` (+114 lines) — byte-parallel bun/node twin.
- `parity/backends.json` (+3 −3) — chat-composer fixture registered on `dotnet-probe`, `bun-probe`, `node-probe`.

## The 5 branches + their exact tripwires

| Branch | Step id | Substring(s) asserted |
|---|---|---|
| (a) IDLE | `idle-initial` (GET) | `"type":"chat-composer"`, `"bind":"chatComposerDraft"`, `"sendAction":{"name":"chat-composer-send"}`, `"attachAction":{"name":"chat-composer-attach"}` |
| (b) STREAMING | `streaming-swap` (POST) | `"status":"streaming"`, `"stopAction":{"name":"chat-composer-stop"}` |
| (c) ATTACH-CLICKED | `attach-toggled` (POST) | `ChatComposerAttached=true tripwire` (server-emitted UNIQUE marker) |
| (d) DROPSCOPE-GLOBAL | `dropscope-global` (POST) | `"dropScope":"global"` |
| (e) SUBMITMODE-CTRLENTER | `submitmode-ctrlenter` (POST) | `"submitMode":"ctrl-enter"` |

Every substring is UNIQUE to its branch (no cross-branch reuse), and every substring was verified to fire on BOTH .NET and bun independently BEFORE running the diff.

## Wire-value validation (proven, not assumed)

- `submitMode` wire spelling is `"ctrl-enter"` (kebab) — confirmed via `viewmodel-shell/src/index.ts:2581` (TS union literal) + `viewmodel-shell-dotnet/ViewModels.cs:313` (`[JsonConverter(typeof(KebabEnum<ChatComposerSubmitMode>))]`).
- `status:"streaming"` is a closed-enum kebab value emitted as-is.
- `dropScope:"global"` is a closed-enum kebab value emitted as-is.
- The `type` discriminator is `"chat-composer"` (kebab) confirmed via `viewmodel-shell-dotnet/ViewModels.cs:982` (`[JsonDerivedType(typeof(ChatComposerNode), "chat-composer")]`).

## Parity run — final green

```
Fixture 'chat-composer' across 3 backends:
  dotnet-probe: 5 steps captured
  bun-probe: 5 steps captured
  node-probe: 5 steps captured
  ✓ all backends agree
...
✓ Parity tests passed
```

`bun run parity/run.ts` exit code: **0** (all 17 backends, all fixtures — pre-existing + new — green).

## Adversarial-break test (per plan Task 4)

Corrupted the first step's tripwire (`"type":"chat-composer"` → `"type":"chat-composer"XXXNONEXISTENT`), re-ran parity, confirmed loud failure:

```
error: dotnet-probe step 'idle-initial' did not reach the branch it claims to cover —
  missing expected substring(s): "\"type\":\"chat-composer\"XXXNONEXISTENT". This step
  exists to EXERCISE that branch; if the branch no longer fires, the step is vacuous
  and the cross-backend diff is silently proving nothing about it.
```

Restored fixture from `/tmp/chat-composer-backup.json`, re-ran parity, confirmed green — the tripwire mechanism operationally proven, not just theoretically installed.

## Deviations from Plan

None materially — 4 deviations from the plan TEXT documented as adjustments, none affect the plan INTENT:

1. **[Rule 3 — Blocking issue] Backend names differed from plan text.** Plan referenced `dotnet-feature-probe / bun-feature-probe / node-feature-probe`; actual `parity/backends.json` uses `dotnet-probe / bun-probe / node-probe`. Registered under the correct 3 names.
2. **[Rule 3 — Blocking issue] `findNulls: false` per-step field is not part of the FixtureStep TS interface.** The invariant is UNCONDITIONAL in `parity/run.ts:314-322` (fires on every step, no opt-in). Omitted the field from the shipped fixture; documented in the `$comment` block that findNulls binds every step regardless.
3. **[Rule 2 — Missing critical detail] Branch-C tripwire changed from `"vms-chat-composer__chip"` to server-emitted `ChatComposerAttached=true tripwire` marker.** The chip strip is CLIENT-SIDE only (File registry in adapter, not state), so a CSS class-name substring is never on the wire regardless of branch state. Replaced with a server-emitted TextNode carrying a mutation-proof unique string (grep-confirmed unique across the whole repo).
4. **[Rule 3 — Blocking issue] `IconName.Square` referenced in plan `must_haves` is not in the shipped .NET `IconName` enum.** Not required for the wire proof — icons are rendered client-side from `status`, no icon serialization on the wire. Tripwire mechanism relies on the closed-enum `status:"streaming"` string alone.

## Green-tree gate — full state at commit time

| Gate | Result |
|---|---|
| `bun run parity/run.ts` (17 backends, 12 fixtures + skill parity) | ✓ exit 0 |
| `npm run check:core-globals` | ✓ exit 0 |
| `npm run check:demo-types` (25 demo projects) | ✓ exit 0 |
| `npm run check:test-types` | ✓ exit 0 |
| `npm run check:no-demo-style` (23 hand-edited HTML files) | ✓ exit 0 |
| `dotnet test viewmodel-shell-dotnet/Tests` | ✓ 458 passed |
| `dotnet test demo/Tasks/AspNetCore.Tests` | ✓ 28 passed |
| `dotnet test demo/ContactManager/AspNetCore.Tests` | ✓ 39 passed |
| `dotnet test demo/HelpDesk/AspNetCore.Tests` | ✓ 61 passed |
| `dotnet test demo/ExpenseTracker/AspNetCore.Tests` | ✓ 30 passed |
| `dotnet test demo/RetroBoard/AspNetCore.Tests` | ✓ 33 passed |
| `cd viewmodel-shell && npx vitest run` | ✓ 1380 passed, 1 skipped |

## Git status pre-commit

```
 M demo/FeatureProbe-bun/handler.ts
 M demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
 M parity/backends.json
?? parity/fixtures/chat-composer.json
```

(Untracked `.planning/**` files + `.vite/` + `server.pid` are pre-existing carryover from earlier phases; not part of this plan.)

## Self-Check: PASSED

- `parity/fixtures/chat-composer.json` exists (56 lines, 5 steps, per-branch expectBodyContains + $comment citing gotcha #9 class-3 + gotcha #8 class-2).
- Both backends' FeatureProbeState carries the 6 new slots (grep-confirmed).
- Both backends' buildVm renders `ChatComposerNode` (grep + curl confirmed).
- Both backends' action handlers carry 4 branch-mutators + 3 no-op passthroughs.
- `parity/backends.json` registers chat-composer on all 3 FeatureProbe backends (python3 script confirmed).
- `bun run parity/run.ts` exits 0, all backends agree on all 5 steps.
- Adversarial-break test confirmed the tripwire fires LOUDLY on regression.
- Full green-tree gate PASSED (parity + core-globals + demo-types + test-types + no-demo-style + framework .NET tests + every demo .Tests + vitest).
