---
phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
plan: 04
subsystem: framework
tags: [version-skew, ts-server-subpath, global-guard, createVersionGuard, get-gap, vitest]

# Dependency graph
requires:
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-03"
    provides: Client X-VMS-Client-Build header on GET (SKEW-03) — every GET now advertises the client build so the TS-server-subpath global guard has something to enforce against
provides:
  - createVersionGuard factory in viewmodel-shell/src/server.ts (TS twin of .NET ShellVersionGuardFilter from Plan 29-02)
  - One-line consumer wiring shape — `app.get(path, guard(handler))` + `app.post(path, guard(createAction<TState>(handler)))`
  - 5-test describe block in viewmodel-shell/test/version-skew.test.ts covering the four documented branches (mismatch, match, absent-header, inert × 2)
  - Byte-parallel wire message text with the shipped in-createAction guard (parity fixture in Plan 29-07 can diff both guards' 400 stale_client envelope byte-for-byte)
affects: [29-07 (parity fixture — GET-stale steps will exercise createVersionGuard end-to-end against the HelpDesk-bun twin once wired), 29-11 (MIGRATION.md v9.0.0 upgrade section — documents the new one-liner wrap for GET routes)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TS-side global guard as a factory-returning-a-generic-wrap (`<T extends (req: Request) => Promise<Response>>(handler: T) => T`) — the shape the planner picked in preference to a middleware adaptation, per CONTEXT `<decisions>`. Preserves consumer's typed handler signature end-to-end via the generic constraint + `as never` cast at the internal boundary."
    - "Byte-parallel wire message text between two guards (in-createAction + createVersionGuard) enforced by acceptance grep `grep -c 'does not match the'` >= 2 — the tripwire against class-1 parity drift (per AGENTS.md gotcha #9: two backends emitting the same wrong thing agree perfectly)."
    - "Identity-wrap on empty/undefined currentBuild — same shape the .NET ShellVersionGuardFilter uses; makes the factory safe to apply unconditionally even in dev builds without a BUILD_ID configured."

key-files:
  created:
    - .planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-04-SUMMARY.md
  modified:
    - viewmodel-shell/src/server.ts
    - viewmodel-shell/test/version-skew.test.ts

key-decisions:
  - "createVersionGuard placed immediately BEFORE createAction (lines 1310-1358), not after — the two related exports group visually and the guard's TSDoc @example references createAction, so createAction is the reader's next stop when they follow the pointer. Alternative placement (after createAction) considered and rejected on read-flow grounds."
  - "Inner arrow parameter carries an explicit type annotation (`(handler: (req: Request) => Promise<Response>) =>`) — the strict `noImplicitAny` config on `tsconfig.tui.json` (used by `npm run build`) refused an implicit-any parameter inside the outer generic returning `as never`. The annotation is a Rule-3 fix caught by the first build after Task 1's initial edit; the outer generic's type-safety is preserved (consumers still get typed narrowing at the call site)."
  - "Test imports use a static top-of-file import (`import { createVersionGuard } from '../src/server.js';`) rather than the plan's dynamic-import fallback — the file already had a top-of-file import block from `../src/index.js`, and the plan explicitly instructed to hoist rather than repeat dynamic imports. Simpler surface area, same coverage."

requirements-completed: [SKEW-01, SKEW-02]

# Metrics
duration: ~2min
completed: 2026-08-02
---

# Phase 29 Plan 04: TS server-subpath createVersionGuard factory + vitest coverage

**Landed the TS-server-subpath equivalent of the .NET global guard: a small `createVersionGuard({ currentBuild })(handler)` factory that wraps any `(Request) => Promise<Response>` handler (GET or POST) and short-circuits with a 400 `stale_client` envelope BEFORE the handler runs when the `X-VMS-Client-Build` header mismatches. Consumers apply it around ANY VMS route with a one-line wrap; the pre-9.0.0 gap where GETs bypassed the guard entirely is now closable on both backends. The shipped in-createAction guard is UNTOUCHED per SKEW-02's defense-in-depth mandate — consumers upgrading to v9.0.0 with NO wiring change still get the shipped v3.8.0 POST-side behavior; adding the wrap is a NEW step that closes the GET gap. 5 new vitest tests cover the four documented branches (mismatch, match, absent-header, inert × 2). Full framework vitest suite green: 1358 tests + 1 skipped (was 1353 + 1 pre-plan; +5 exactly matches the new tests).**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-08-02T21:37:32Z
- **Completed:** 2026-08-02T21:39:51Z
- **Tasks:** 2
- **Files modified:** 2 (viewmodel-shell/src/server.ts, viewmodel-shell/test/version-skew.test.ts)

## Modification Sites (exact final line numbers)

Post-plan line numbers:

| # | Site | Line | What lands |
|---|------|------|------------|
| 1 | `viewmodel-shell/src/server.ts` — new `createVersionGuard` factory (SKEW-01) | 1334 | 25-line TSDoc + 22-line body; identity-wrap on empty currentBuild; mismatched-header short-circuit; message text byte-parallel with the shipped in-createAction guard |
| 2 | `viewmodel-shell/src/server.ts` — `createAction` (unchanged, for context) | 1385 | Byte-identical to pre-plan (verified via `git diff --diff-filter=D` returning zero deletions) |
| 3 | `viewmodel-shell/test/version-skew.test.ts` — top-of-file import hoist | 21 | `import { createVersionGuard } from "../src/server.js";` added below the existing `../src/index.js` import block |
| 4 | `viewmodel-shell/test/version-skew.test.ts` — new 5-test describe block | 361 | Appended at bottom of file; describe named `9.0.0 — createVersionGuard TS-server-subpath wrap (SKEW-01)` |

## Accomplishments

- **`createVersionGuard` factory shipped** at line 1334 of `viewmodel-shell/src/server.ts`, immediately BEFORE `createAction` (which is now at line 1385). The two related exports group visually and the guard's TSDoc `@example` references createAction, so a reader following the pointer lands on `createAction` in the next screen. Signature: `createVersionGuard(options: { currentBuild?: string }): <T extends (req: Request) => Promise<Response>>(handler: T) => T`.
- **Byte-parallel wire message text** with the shipped in-createAction guard: both emit `` `Stale client: request build "${clientBuild}" does not match the current deployed build "${currentBuild}". Reload to continue.` `` — verified by `grep -c 'does not match the' viewmodel-shell/src/server.ts` returning 2 (was 1 pre-plan). The parity fixture in Plan 29-07 will diff both guards' 400 stale_client envelopes byte-for-byte over HTTP; today's tripwire catches drift at the same-file intra-consistency level.
- **Identity wrap on empty/undefined currentBuild** — the factory returns the handler unchanged (same function reference; verified by `expect(guarded).toBe(handler)` in two of the five new tests). Consumers can apply the wrap unconditionally even in dev builds without a `BUILD_ID` configured; the behavior is byte-identical to versioning-off apps.
- **In-createAction guard block preserved byte-for-byte** — `git diff --diff-filter=D --name-only HEAD~2 HEAD` returned nothing (no deletions across both commits). SKEW-02's defense-in-depth mandate held: consumers who don't wrap their routes still get the shipped v3.8.0 POST-side behavior; wrapping is a NEW step for GET-gap closure, not a replacement.
- **Test-file top-of-file import hoisted** — `createVersionGuard` imported statically at the top of `viewmodel-shell/test/version-skew.test.ts` (line 21, immediately after the existing `../src/index.js` import block), so the five test bodies reference it directly rather than dynamically importing per test. Simpler surface area, same coverage.
- **5-test describe block appended** at line 361 of the test file (title `9.0.0 — createVersionGuard TS-server-subpath wrap (SKEW-01)`) — the four documented branches each have executable proof:
  1. `mismatched header → 400 stale_client envelope BEFORE handler runs` — asserts `res.status === 400`, `body.ok === false`, `body.errors[0].code === "stale_client"`, AND `handlerRan === false` (the last is the pre-9.0.0 GET-gap this factory closes: the handler never sees the stale client's request).
  2. `matching header → handler runs; response passes through` — asserts `res.status === 200` and `await res.text() === "ok"`.
  3. `absent header → handler runs (agent-driven curl still works)` — preserves the shipped semantic that a header-less curl still works for agent-driven testing.
  4. `empty currentBuild → identity wrap` — asserts `guarded === handler` (same reference).
  5. `undefined currentBuild → identity wrap` — asserts the same on `createVersionGuard({})` (defensive: consumers may omit the field entirely).

## Task Commits

Each task was committed atomically on `main`:

1. **Task 1: Add createVersionGuard factory to server.ts** — `77e8087` (feat)
2. **Task 2: Add vitest coverage for createVersionGuard in version-skew.test.ts** — `d34ef23` (test)

## Files Modified

- `viewmodel-shell/src/server.ts` — 1 commit (feat), +50 lines net. Single insertion site above `createAction`; zero deletions confirmed.
- `viewmodel-shell/test/version-skew.test.ts` — 1 commit (test), +52 lines net. Top-of-file import hoist (+1 line) + 5-test describe block appended at bottom (+51 lines).

## Gate Verification (pre-plan baseline vs post-plan)

| Gate | Pre-plan | Post-plan |
|------|----------|-----------|
| `cd viewmodel-shell && npm run build` | exit 0 | exit 0 |
| `cd viewmodel-shell && npm run check:test-types` | exit 0 | exit 0 |
| `cd viewmodel-shell && npx vitest run` | 82 files, 1353 tests + 1 skipped | 82 files, **1358 tests** + 1 skipped |
| `cd viewmodel-shell && npx vitest run test/version-skew.test.ts` | 15 tests | **20 tests** (all passing) |
| `grep -c 'export function createVersionGuard' src/server.ts` | 0 | **1** |
| `grep -c 'ERR_CODES.STALE_CLIENT' src/server.ts` | 1 | **2** (+1 from the new factory) |
| `grep -c 'does not match the' src/server.ts` (byte-parallel wire message tripwire) | 1 | **2** (in-createAction guard + new factory) |
| `grep -c 'createVersionGuard' test/version-skew.test.ts` | 0 | **7** (1 import + 1 describe title + 5 test bodies) |
| `grep -c 'describe("9.0.0' test/version-skew.test.ts` | 4 (from Plan 29-03) | **5** (+1 for createVersionGuard) |
| `grep -c 'describe("9.0.0 — createVersionGuard' test/version-skew.test.ts` | 0 | **1** |
| `grep -cE '^  it\(' test/version-skew.test.ts` | 15 | **20** (+5) |
| `git diff --diff-filter=D --name-only HEAD~2 HEAD` (deletions across both commits) | n/a | (nothing — purely additive) |

## Byte-Identity Verification (must be unchanged per plan scope)

- **`createAction` factory body** (lines 1342-1358 pre-plan → 1392-1408 post-plan; the guard block is untouched aside from the file-position shift): verified byte-identical via `git diff --diff-filter=D` returning zero deletions across both commits. The shipped in-createAction guard remains for defense-in-depth per SKEW-02.
- **`ERR_CODES.STALE_CLIENT` constant** (line 1266): untouched; both guards read the same constant.
- **`jsonResponse` + `errorEnvelope` helpers** (lines 1277 + 1301): untouched; both guards call the same helpers.
- **`viewmodel-shell/src/index.ts`** (client-side): untouched — Plan 29-03 owns the GET header attachment, this plan owns the server-side receive-and-enforce.
- **`viewmodel-shell-dotnet/Versioning.cs`** (.NET filter): untouched — Plan 29-02 owns the .NET semantic twin.
- **Pre-plan describe blocks 1–4 in version-skew.test.ts** (3.8.0 detection + 3.8.0 header + 3.8.0 stale-client + 9.0.0 GET-header + 9.0.0 detection modal + 9.0.0 stale-client modal + 9.0.0 opt-out): untouched — this plan appends a 5th 9.0.0 describe block below them.

## Decisions Made

- **Factory placement immediately BEFORE createAction, not after.** The two related exports group visually; the guard's TSDoc `@example` references createAction, so a reader following the pointer lands on `createAction` in the next screen. Alternative placement (after createAction) considered and rejected on read-flow grounds — the guard is the outer, the action factory is the inner, so the outer reads first.
- **Explicit type annotation on the inner arrow's `handler` parameter** — the first build after Task 1's initial edit failed with `TS7006: Parameter 'handler' implicitly has an 'any' type` under `noImplicitAny` (the strict flag used by both `npm run build` and `npm run check:test-types`). The annotation `(handler: (req: Request) => Promise<Response>) =>` inside the outer generic is the minimal fix that preserves the outer generic's consumer-facing type-safety while satisfying the compiler's contravariant-parameter inference. This is a Rule-3 auto-fix; the outer generic's `<T extends (req: Request) => Promise<Response>>(handler: T) => T` is the caller-facing contract and remains unchanged.
- **Static top-of-file import in the test file** rather than the plan's dynamic-import fallback. The file already had a top-of-file import block from `../src/index.js`; the plan explicitly instructed to hoist rather than repeat dynamic imports if the top-of-file imports were already present. Simpler surface area, same coverage. The five test bodies now reference `createVersionGuard` directly.
- **Identity-wrap comparison uses `.toBe(handler)` (strict reference equality)**, not `.toEqual(handler)`. The plan's intent is that the wrapper returns the SAME function reference when versioning is off (not a new function that happens to behave the same); reference equality is the only assertion that proves the no-overhead posture. This matches the .NET filter's `if (currentBuild is null) return` early-exit shape.

## Deviations from Plan

**[Rule 3 - Blocking issue] Explicit type annotation on the inner arrow's `handler` parameter.**

- **Found during:** Task 1 (first `npm run build` after inserting the factory)
- **Issue:** `src/server.ts(1338,12): error TS7006: Parameter 'handler' implicitly has an 'any' type.` The plan's provided body used `return ((handler) => {...}) as never;` — under the strict `noImplicitAny` flag on both `tsconfig.tui.json` (npm run build) and `tsconfig.test.json` (npm run check:test-types), an untyped parameter inside the outer generic returning `as never` cannot be inferred and the compiler refuses. The `as never` cast at the return boundary is what strips the type back to the outer generic's `T`, so the inner parameter needs an explicit type of its own for the compiler to type-check the closure body.
- **Fix:** Annotated the inner parameter as `(handler: (req: Request) => Promise<Response>) =>`. Same shape as the outer generic's constraint (`T extends (req: Request) => Promise<Response>`), so no behavior change; just satisfies the compiler.
- **Files modified:** `viewmodel-shell/src/server.ts` (Task 1 commit — same commit, before the initial commit push).
- **Commit:** `77e8087` (the annotation is included in the shipped factory body).

None otherwise — plan executed exactly as written. Grep-based acceptance criteria all pass. Byte-parallel wire message text verified.

## Issues Encountered

- **Initial build TS7006 (fixed in the same commit).** See "Deviations from Plan" above. Root cause: the plan-provided body relied on the outer generic's constraint to flow through to the inner parameter, which strict `noImplicitAny` doesn't allow (contravariant-parameter inference requires an explicit annotation). Detected on the very next `npm run build` after the insert; annotation added, build re-run, exit 0. No test failures resulted (this was purely a type-level fix before any test executed against the factory).

## User Setup Required

None. This is a pure additive change inside `viewmodel-shell/`. No new dependencies, no config, no runtime behavior change for CONSUMERS on the shipped in-createAction guard (that guard remains byte-identical). The new `createVersionGuard` export becomes available on the `@ashley-shrok/viewmodel-shell/server` subpath on the next npm publish (Plan 29-12); consumer wiring is opt-in one-liner: `app.get(path, guard(handler))` + `app.post(path, guard(createAction<TState>(handler)))`.

## Next Phase Readiness

- **Plan 29-06 (BrowserAdapter.showSkewLock DOM)** — READY. Independent of this plan (owns the client-side DOM/CSS work).
- **Plan 29-07 (parity fixture)** — READY to add GET-stale fixture steps. Both backends now have a global guard capable of enforcing on GET requests: .NET's `ShellVersionGuardFilter` (Plan 29-02, self-registered via `AddVmsShellVersioning`) and TS's `createVersionGuard` (this plan, opt-in per route). The parity fixture will exercise both over HTTP against the two HelpDesk backends and diff the byte-identical 400 stale_client envelope; the byte-parallel wire message text established here is the same-side tripwire, and the parity fixture is the cross-side tripwire.
- **Plan 29-08 (agent-skill.md)** — READY to document the new `createVersionGuard` wiring pattern in the "Client build / version skew" section, mirroring the .NET `AddVmsShellVersioning` pattern already documented.
- **Plan 29-11 (MIGRATION.md v9.0.0)** — READY to draft the "GET-guard adoption" migration note: consumers on the TS server subpath add one line per route (`guard(handler)`) to close the pre-9.0.0 GET gap; the shipped in-createAction guard continues to work unchanged for POST routes (SKEW-02 defense-in-depth).

## Self-Check: PASSED

**Files created:** verified
- `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-04-SUMMARY.md` — FOUND (this file, written by Write tool)

**Files modified:** verified
- `viewmodel-shell/src/server.ts` — FOUND (line 1334 new factory)
- `viewmodel-shell/test/version-skew.test.ts` — FOUND (line 21 import hoist + line 361 new describe block)

**Commits exist:** verified via `git log --oneline -3`
- `77e8087` — FOUND (Task 1: createVersionGuard factory)
- `d34ef23` — FOUND (Task 2: vitest coverage)

**Vitest exit output confirming all tests pass** — captured verbatim:
```
 ✓ test/version-skew.test.ts (20 tests) 10ms

 Test Files  82 passed (82)
      Tests  1358 passed | 1 skipped (1359)
   Duration  2.99s
```

---
*Phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-*
*Completed: 2026-08-02*
