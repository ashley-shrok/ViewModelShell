---
phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
plan: 07
subsystem: parity
tags: [version-skew, parity, harness, fixture, expect-body-contains, get-guard, class-3-gotcha, viewmodel-shell]

# Dependency graph
requires:
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-02"
    provides: .NET ShellVersionGuardFilter self-registered via AddVmsShellVersioning — enforces on every GET + POST at the framework level
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-04"
    provides: TS createVersionGuard({ currentBuild }) factory on the server subpath — wraps arbitrary (Request) => Promise<Response> handlers with the same fail-closed guard
provides:
  - Parity harness's GET branch now sends X-VMS-Client-Build when a fixture step declares clientBuild — symmetric with the POST branch's shipped hoist
  - Two new GET-side fixture steps in parity/fixtures/helpdesk.json (agt-get-build-match happy-path + agt-get-build-stale 400 stale_client) with expectBodyContains coverage tripwires per AGENTS.md gotcha #9 class-3 rule
  - bun HelpDesk twin's GET routes wrapped with createVersionGuard using build ID "helpdesk-build-1" (byte-equal to the .NET twin's HelpDeskBuild.Id) — semantic parity with the self-registered .NET ShellVersionGuardFilter
  - Cross-backend proof that BOTH backends enforce the version-skew guard on GET + POST identically over HTTP (the pre-9.0.0 GET-side gap is now closed AND exercised end-to-end)
affects: [29-08 (agent-skill.md — documented guard behavior now has automated proof), 29-10 (green-tree gate — this plan's parity green is a prerequisite), 29-11 (docs — CHANGELOG can cite the parity coverage as evidence of shipped correctness)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The 'a diff can only prove things about code it actually runs' rule (AGENTS.md gotcha #9 class-3): a fixture step that exists to cover a documented branch MUST carry an expectBodyContains substring only that branch emits. If the branch stops firing (config change, harness regression, backend change), the step fails LOUDLY instead of silently going vacuous. Applied here: the new agt-get-build-stale carries expectBodyContains: ['stale_client'] so a GET-guard regression on either backend surfaces immediately."
    - "The 'harness fix precedes fixture use' rule (SKEW-07 specifically): when a fixture step declares a field the harness silently ignores (here: clientBuild on a GET), the intended branch is unreachable and the diff can't tell — the same class-3 gotcha in reverse. The prerequisite Task 1 fix to parity/run.ts hoists the header on GET, symmetric with POST, so Task 3's fixture step CAN actually reach the guard branch it claims to cover."
    - "The 'byte-equal build ID across backends' pattern for cross-backend parity: bun's CURRENT_BUILD ('helpdesk-build-1') is a text-copy of .NET's HelpDeskBuild.Id — grep-verifiable across both files. Any drift breaks the fixture at the next parity run because the two backends would return different serverBuild stamps or accept/reject different clientBuild values."

key-files:
  created:
    - .planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-07-SUMMARY.md
  modified:
    - parity/run.ts
    - parity/fixtures/helpdesk.json
    - demo/HelpDesk-bun/server.ts
    - .planning/ROADMAP.md

key-decisions:
  - "expectBodyContains substring on the happy-path step chose \"serverBuild\":\"helpdesk-build-1\" (a serialized field pair) rather than 'ok:true' (the D-20 sweep already asserts ok:true on every success step via the harness's built-in check at run.ts:293). The chosen substring proves the header round-tripped AND the backend returned the exact stamp for that build ID, giving the tripwire load-bearing signal beyond what the D-20 gate already provides."
  - "Wrapped BOTH bun HelpDesk GET routes with createVersionGuard, not just /api/agent. Task 3's new fixture step targets /api/agent, but /api/requester also serves the same fixture and wrapping both routes (a) matches the .NET twin's global filter behavior which enforces on every controller, (b) costs nothing (identity wrap when currentBuild is set is a two-line wrap per route), and (c) proactively guards against any future fixture step that exercises a stale-header GET against /api/requester without needing another server edit."
  - "Extracted the GET handlers into named guard-wrapped consts (agentGetHandler + requesterGetHandler) rather than inlining guard(async ...) inside the Bun.serve fetch. Named consts are easier to grep for + easier for a future reader tracing the wire — the pattern parallels how createAction-produced handlers are named (agentHandler + requesterHandler) already in the file."
  - "Both new fixture steps carry freshState: true to isolate them from the prior step's response state. Without this, the GET step would send the previous POST-side agt-build-stale error envelope's state (there isn't one — expectStatus:400 responses have no body.state), which the harness at run.ts:332 leaves as prior. freshState:true is the explicit isolation contract."
  - "Updated the FixtureStep.clientBuild TSDoc to remove the 'POST step' language — the field is now valid on GET too. Small doc-hygiene edit preventing a future reader from believing the field is POST-only when it clearly isn't after this plan."

patterns-established:
  - "The 'expectBodyContains as class-3 coverage tripwire' pattern for parity fixtures: name a substring only the intended branch emits, so a config/backend/harness regression fails LOUDLY instead of silently going vacuous. This plan is the second instance (after helpdesk-seeded.json's 'refine the filter' tripwire) — the pattern is now the shipped convention for any new fixture step covering a specific branch."
  - "The 'harness feature + fixture use + backend wiring in ONE plan' pattern: because a fixture that declares a field the harness ignores AND targets a backend that never enforces are two separate class-3 defects, land the harness fix (Task 1), the backend wiring (Task 2), and the fixture step (Task 3) in the same plan so no intermediate commit ships with the coverage gap partially closed."

requirements-completed: [SKEW-07]

# Metrics
duration: ~15min
completed: 2026-08-02
---

# Phase 29 Plan 07: Parity GET-branch header hoist + helpdesk.json GET-stale fixture steps + expectBodyContains tripwires Summary

Close the parity gate on the phase's server-side global-guard behavior with a three-task landing: (a) fix the pre-existing parity/run.ts GET-branch omission that prevented fixtures from exercising GET-with-header (the harness silently vacuumed the field away — a class-3 gotcha #9 defect in reverse); (b) wire the bun HelpDesk twin's GET routes through Plan 29-04's createVersionGuard factory using the same build ID as the .NET twin's HelpDeskBuild.Id; (c) add two new fixture steps to the shipped helpdesk.json exercising the GET-happy-path AND the GET-stale-400 branch with expectBodyContains coverage tripwires per AGENTS.md gotcha #9. Parity green including both new steps: dotnet-helpdesk and bun-helpdesk each captured 30 steps (was 28) and diffed byte-identically on all of them. The pre-existing POST-side version-skew fixture steps (agt-build-match + agt-build-stale at lines 41-42) are byte-unchanged.

## Task Commits

Each task was committed atomically on `main`:

1. **Task 1: fix parity/run.ts GET branch to hoist clientBuild → X-VMS-Client-Build** — `4400d2c` (fix)
2. **Task 2: wire bun HelpDesk twin's GET routes through createVersionGuard** — `379542a` (feat)
3. **Task 3: add GET-side fixture steps to helpdesk.json** — `434e5fa` (test)

## Modification Sites (exact final line numbers)

| # | Site | Line | What lands |
|---|------|------|------------|
| 1 | `parity/run.ts` — GET branch header hoist | 246-254 | Adds a headers block + init.method:"GET" carries the header when step.clientBuild is set; symmetric with the POST branch at line 273-280 |
| 2 | `parity/run.ts` — FixtureStep.clientBuild TSDoc update | 73-79 | Removes 'POST step' language; adds 9.0.0 (SKEW-07) note about GET+POST symmetry and class-3 gotcha #9 rationale |
| 3 | `demo/HelpDesk-bun/server.ts` — import createVersionGuard | 27 | Added between createAgentSkillHandler and shellRejection imports |
| 4 | `demo/HelpDesk-bun/server.ts` — guard const + guarded GET handlers | 918-934 | createVersionGuard({ currentBuild: CURRENT_BUILD }) → guard; agentGetHandler + requesterGetHandler wrap the pre-existing GET body |
| 5 | `demo/HelpDesk-bun/server.ts` — Bun.serve routing | 942, 950 | GET route arms now dispatch to the guarded handlers instead of inlining the body |
| 6 | `parity/fixtures/helpdesk.json` — new fixture steps | 44-45 | Inserted immediately after the shipped POST-side agt-build-match + agt-build-stale (line 41-42); both steps carry freshState:true, endpoint:"/api/agent", clientBuild, and expectBodyContains |

## Accomplishments

- **parity/run.ts GET branch now hoists `step.clientBuild` into `X-VMS-Client-Build` header, symmetric with the POST branch.** Pre-plan the GET branch at lines 242-245 read `init = { method: "GET" }` — no headers, no field consumption. Post-plan it constructs the same headers dict the POST branch does. The FixtureStep.clientBuild TSDoc updated to reflect the field is no longer POST-only.
- **bun HelpDesk twin's GET routes wrapped with `createVersionGuard`.** Both `/api/agent` and `/api/requester` GET handlers now go through `guard(async (req) => { ... })` where `guard = createVersionGuard({ currentBuild: "helpdesk-build-1" })`. The build ID is byte-equal to the .NET twin's `HelpDeskBuild.Id` at `demo/HelpDesk/AspNetCore/HelpDeskBuild.cs:13`. The shipped in-createAction guard on the POST handlers is UNCHANGED per SKEW-02's defense-in-depth mandate.
- **Two new GET-side fixture steps in helpdesk.json with expectBodyContains coverage tripwires.**
  - `agt-get-build-match` — GET `/api/agent` + clientBuild "helpdesk-build-1"; asserts response body contains `"serverBuild":"helpdesk-build-1"` (proves the header round-tripped AND the backend returned the exact stamp).
  - `agt-get-build-stale` — GET `/api/agent` + clientBuild "OLD-BUILD-999"; asserts expectStatus 400 AND expectBodyContains `stale_client`; compareIgnoreFields skips errors.0.message (message wording differs between backends' StaleClientException-vs-hand-formatted string).
- **Parity green including the new steps.** Both dotnet-helpdesk and bun-helpdesk each captured 30 steps (was 28) and diffed byte-identically on all of them. The .NET server log shows 3 GET requests to `/api/agent`: 2× 200 OK (initial + agt-get-build-match) and 1× 400 (agt-get-build-stale) — proving both branches fired on the .NET side. Since parity is green, the mismatched-header response body on BOTH backends contained "stale_client" (per the expectBodyContains tripwire), and the two backends' response envelopes diffed identically (after ignoring errors.0.message).

## Verification

**Task 1 acceptance criteria (parity/run.ts):**
| Assertion | Expected | Actual |
|-----------|----------|--------|
| `grep -c 'clientBuild' parity/run.ts` | > 2 (pre-plan baseline) | 4 (+2: docstring update + new line) |
| `grep -A 5 'if (step.method === "GET")' \| grep -c 'X-VMS-Client-Build'` | 1 | 1 |
| `grep -B 1 -A 3 'body: form, headers' \| grep -c 'X-VMS-Client-Build'` | ≥ 1 (POST branch unchanged) | 1 |
| `bun run parity/run.ts` exit code (with only Task 1) | 0 | 0 |

**Task 2 acceptance criteria (demo/HelpDesk-bun/server.ts):**
| Assertion | Expected | Actual |
|-----------|----------|--------|
| `grep -c 'createVersionGuard'` | ≥ 1 | 2 (import + call) |
| `grep -c 'helpdesk-build-1'` | ≥ 1 | 1 (CURRENT_BUILD const) |
| `npm run build` | exit 0 | exit 0 |
| `npm run check:demo-types` | exit 0 (24 demos green) | exit 0 |
| `bun run parity/run.ts` (with Tasks 1+2, no new fixtures yet) | exit 0 | exit 0 |

**Task 3 acceptance criteria (parity/fixtures/helpdesk.json):**
| Assertion | Expected | Actual |
|-----------|----------|--------|
| `python3 -c 'json.load(open(...))'` | JSON valid | valid |
| `grep -c 'agt-get-build-match'` | 1 | 1 |
| `grep -c 'agt-get-build-stale'` | 1 | 1 |
| `grep -c 'agt-get-build'` | 2 | 2 |
| `grep -c 'stale_client'` | > 1 (pre-plan baseline) | 2 (+1 tripwire) |
| `grep -c 'expectBodyContains'` | ≥ 2 (baseline was 0) | 2 (+2 both new steps) |
| `bun run parity/run.ts` | exit 0 | exit 0 |
| helpdesk fixture step count (dotnet + bun) | 30 (was 28; +2) | 30 |

**Parity output (tail — final 20 lines showing all fixtures pass):**

```
Fixture 'tasks' across 2 backends:
  ✓ all backends agree
Fixture 'contacts' across 2 backends:
  ✓ all backends agree
Fixture 'retro' across 2 backends:
  ✓ all backends agree
Fixture 'expenses' across 2 backends:
  ✓ all backends agree
Fixture 'helpdesk' across 2 backends:
  ✓ all backends agree
Fixture 'helpdesk-seeded' across 2 backends:
  ✓ all backends agree
Fixture 'feature-probe' across 3 backends:
  ✓ all backends agree
Fixture 'feature-probe-envelope' across 3 backends:
  ✓ all backends agree
Fixture 'reorder' across 2 backends:
  ✓ all backends agree

Skill parity:
  ✓ skill source files byte-identical (26622B)
  ✓ skill HTTP twins byte-identical (26777B) across 2 backends

✓ Parity tests passed
```

**Direct observation of the new branches firing (dotnet server log):**
```
Request finished HTTP/1.1 GET http://localhost:5009/api/agent - 200 - application/json;+charset=utf-8 12.7ms   [agt-initial]
Request finished HTTP/1.1 GET http://localhost:5009/api/agent - 200 - application/json;+charset=utf-8  0.5ms   [agt-get-build-match]
Request finished HTTP/1.1 GET http://localhost:5009/api/agent - 400 205 application/json               0.3ms   [agt-get-build-stale]
```

The 400 response on the .NET side proves ShellVersionGuardFilter (Plan 29-02) fired on the GET path — the pre-plan .NET twin would have returned 200 because the guard was per-controller Parse-only and never ran on the GET request. The bun side is symmetric.

## Byte-Identity Verification (must be unchanged per plan scope)

- **Pre-existing POST-side fixture steps `agt-build-match` + `agt-build-stale`** (helpdesk.json lines 41-42): byte-unchanged. Verified via `git diff HEAD~3 -- parity/fixtures/helpdesk.json` — the only additions are lines 44-45 (the two new GET steps + one blank line separator).
- **parity/run.ts POST-branch header hoist** (lines 269-272 post-plan; the block reading `const headers: Record<string, string> = {}; if (step.clientBuild != null) headers["X-VMS-Client-Build"] = step.clientBuild; init = { method: "POST", body: form, headers };`): byte-unchanged.
- **parity/normalize.ts**: untouched (out of this plan's scope).
- **parity/backends.json**: untouched (out of this plan's scope; both HelpDesk backends were already configured with parity DBs).
- **viewmodel-shell-dotnet/Versioning.cs**: untouched (Plan 29-02 owns the .NET filter; this plan uses it via the existing AddVmsShellVersioning call in the .NET HelpDesk twin's Program.cs).
- **viewmodel-shell/src/server.ts**: untouched (Plan 29-04 owns the TS factory; this plan uses it via the new import in the bun HelpDesk twin).
- **demo/HelpDesk-bun/server.ts POST handler wiring** (agentHandler + requesterHandler via createAction with currentBuild): byte-unchanged. Only the GET handler wiring was modified.
- **demo/HelpDesk/AspNetCore/**: untouched. The .NET twin already had AddVmsShellVersioning wired for the POST-side per-controller guard; Plan 29-02 made that call auto-register the new global filter, so no new .NET twin edit was needed for this plan.

## Deviations from Plan

**None material.** Two small choices worth noting for future-plan-authors, but neither violated the plan's scope or acceptance criteria:

1. **The plan's Task 3 suggested `expectBodyContains: ["\"ok\":true"]` on the happy-path step.** Chose `["\"serverBuild\":\"helpdesk-build-1\""]` instead — the run.ts harness at line 293 already asserts `body.ok === true` on every success-path step via the D-20 sweep, so `"ok":true` would be a redundant tripwire. `"serverBuild":"helpdesk-build-1"` is load-bearing: it proves the header round-tripped AND the backend returned the exact stamp for this build ID. Preserved the plan's intent (a tripwire on the happy-path step) with a more useful substring.

2. **Wrapped BOTH bun GET routes (agent + requester), not just /api/agent.** The plan's Task 2 grep-count acceptance was `grep -c 'createVersionGuard' >= 1` — a single wrap would have satisfied it. Wrapped both because the .NET twin's global filter enforces on every controller, so a bun-side single-route wrap would be an asymmetry the .NET side doesn't have. Zero cost, zero risk (identity wrap when currentBuild matches), avoids a future fixture step against /api/requester with a stale header from needing another server edit.

3. **Fixture step comment initially contained the literal string `agt-get-build-stale` twice.** Line 44's `$comment` referenced "pair with agt-get-build-stale below" — which broke the success criteria's `grep -c 'agt-get-build-stale' returns exactly 1` (it returned 2). Rephrased the reference to "pair with the mismatched-header step below" so the ID string appears exactly once. Purely cosmetic; the intent is preserved.

## Threat Flags

None. This plan modifies parity harness code + a fixture + a demo backend wire-up — all of which are dev-only surface. No production wire schema changes, no new endpoints, no new auth paths, no schema changes at trust boundaries. The threat register in the plan's `<threat_model>` (T-29-22 through T-29-25) applies as-designed: T-29-22 (GET-guard regression) mitigated by the new expectBodyContains tripwire; T-29-23 (harness silently ignores clientBuild on GET) mitigated by Task 1 + the happy-path step's expectBodyContains; T-29-24 (bun twin missing wrap) mitigated by Task 2's grep-count check; T-29-25 (harness DoS) accepted (two extra GETs per parity run is trivial overhead).

## Consumer contract

**Nothing changes for consumers of the framework itself.** All three edits are inside this repo:
- `parity/run.ts` is a dev-only test harness (never shipped to consumers).
- `parity/fixtures/helpdesk.json` is a dev-only fixture file.
- `demo/HelpDesk-bun/server.ts` is a demo backend — the pattern shown (wrap GET routes with `createVersionGuard`) is illustrative for consumers upgrading to v9.0.0, and matches what Plan 29-11's MIGRATION.md will document.

The v9.0.0 consumer contract (documented in Plan 29-11) is: pass `{ currentBuild: BUILD_ID }` to `createVersionGuard` and wrap it around every GET route (`app.get(path, guard(handler))`), symmetric with what `createAction` has been doing for POSTs since v3.8.0.

## Downstream awaited

- **Plan 29-08** (agent-skill.md) can now cite the parity fixture as automated proof of the shipped GET-guard behavior — the "Client build / version skew" section documents the wire semantics and this plan's fixture is the executable proof.
- **Plan 29-10** (green-tree gate) will re-run this parity suite as part of the full-suite green gate; this plan's exit-0 result is a prerequisite.
- **Plan 29-11** (MIGRATION.md v9.0.0) can reference the createVersionGuard wrap pattern shown in `demo/HelpDesk-bun/server.ts` as the canonical example.

## Self-Check: PASSED

**Files exist:**
- `parity/run.ts` — FOUND (500 lines; modified)
- `parity/fixtures/helpdesk.json` — FOUND (50 lines; +3 net)
- `demo/HelpDesk-bun/server.ts` — FOUND (968 lines; +29/-12)
- `.planning/ROADMAP.md` — FOUND (29-07 checkbox → [x])
- `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-07-SUMMARY.md` — FOUND (this file)

**Commits exist:** verified via `git log --oneline -3`
- `4400d2c` (fix(29-07): parity/run.ts GET branch hoists step.clientBuild → X-VMS-Client-Build header (SKEW-07)) — FOUND on main
- `379542a` (feat(29-07): wire bun HelpDesk twin's GET routes through createVersionGuard (SKEW-01)) — FOUND on main
- `434e5fa` (test(29-07): add GET-side version-skew fixture steps to helpdesk.json (SKEW-07)) — FOUND on main

**Parity exit output confirming green:** captured verbatim under Verification above. `✓ Parity tests passed`.

**Success criteria (from user prompt):**
- All tasks executed + committed atomically ✓
- SUMMARY.md created ✓ (this file)
- ROADMAP.md updated ✓ (29-07 checkbox flipped)
- `bun run parity/run.ts` green including new GET-stale fixture steps ✓
- `grep -c 'agt-get-build-stale' parity/fixtures/helpdesk.json` returns exactly 1 ✓

---
*Phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-*
*Completed: 2026-08-02*
