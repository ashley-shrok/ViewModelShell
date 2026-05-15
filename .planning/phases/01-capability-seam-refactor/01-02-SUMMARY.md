---
phase: 01-capability-seam-refactor
plan: 02
subsystem: framework-ci-verification
tags: [typescript, vitest, jsdom, ci-guard, parity, capability-seam, verification-gate]
provides:
  - Standalone grep-based AGNOSTIC-03 guard scoped to src/index.ts only (D-08/D-09/D-11)
  - npm run check:core-globals script (D-10)
  - Net-new framework-level vitest+jsdom harness (vitest.config.ts) — none existed before (D-13)
  - D-12.2 adapter-seam relocation test (navigate/onRedirect-precedence/storage/fail-loud)
  - Two new gating CI steps in the EXISTING parity workflow (guard + adapter test)
  - D-12 dual verification gate satisfied locally (parity 7/7 + adapter test green) AND CI-enforced
affects: [01-03 docs, phase-2-upload-progress]
tech-stack:
  added: [vitest@^2.1.4, jsdom@^25.0.1]
  patterns: [grep-denylist invariant guard, framework-level jsdom adapter test mirroring demo-frontend pattern, dual verification gate (wire parity + adapter relocation proof)]
key-files:
  created:
    - viewmodel-shell/scripts/check-core-platform-globals.mjs
    - viewmodel-shell/vitest.config.ts
    - viewmodel-shell/test/adapter-seam.test.ts
    - viewmodel-shell/package-lock.json
  modified:
    - viewmodel-shell/package.json
    - .github/workflows/parity.yml
key-decisions:
  - "Guard is a standalone Node ESM grep-denylist scoped to src/index.ts ONLY (D-08/D-11); word-boundary regex avoids false-positives on fetch/FormData/setTimeout/URLSearchParams/console"
  - "Denylist = exactly the 5 tokens window/document/localStorage/sessionStorage/XMLHttpRequest (D-09) — no more, no fewer"
  - "Adapter test imports local source via .js NodeNext specifiers (not the published package), mirroring how src/browser.ts imports src/index.ts"
  - "Case B spies on BrowserAdapter.prototype.navigate (jsdom cannot perform real window.location navigation) — asserting the spy fired proves the seam routes to adapter.navigate (D-05 step 2)"
  - "Both new CI steps added to the EXISTING parity job (D-10) — no separate, skippable workflow file"
metrics:
  duration: ~8min
  completed: 2026-05-15
---

# Phase 1 Plan 02: CI Guard + Adapter-Seam Verification (D-12 Dual Gate) Summary

**The "core references zero platform globals" invariant is now CI-enforced by a standalone grep-denylist guard scoped to src/index.ts, a net-new framework-level vitest+jsdom harness proves the Wave 1 core→adapter relocation actually fires (navigate/onRedirect-precedence/storage/fail-loud), and the D-12 dual verification gate (full 7-fixture parity green AND adapter test green) was satisfied locally and wired into the existing parity workflow as gating steps.**

## Performance
- **Duration:** ~8 min (start 2026-05-15T12:30:33Z, end 2026-05-15T12:38:14Z)
- **Tasks:** 3 / 3 completed
- **Files created:** 4 / modified: 2

## Accomplishments

### Task 1 — AGNOSTIC-03 grep guard (commit `9b832d3`)
- `viewmodel-shell/scripts/check-core-platform-globals.mjs`: standalone Node ESM script, zero deps, reads `../src/index.ts` ONLY (D-11 — NOT server.ts, NOT browser.ts).
- Denylist is **exactly** the 5 tokens (D-09): `window`, `document`, `localStorage`, `sessionStorage`, `XMLHttpRequest`. Word-boundary (`\b…\b`) regex.
- `npm run check:core-globals` added to `viewmodel-shell/package.json` (D-10), existing `build`/`prepublishOnly` scripts intact.
- **Verified exit 0** on the clean post-Wave-1 index.ts (which legitimately contains `fetch(`, `FormData(`, `setTimeout(`, `URLSearchParams(`, `console.error` — none false-positived).
- **Negative control proven**: appended `const _x = window;` → guard exited **non-zero** and named `src/index.ts:375 [window]`; `git checkout -- src/index.ts` restored it → guard back to **exit 0**. T-02-01 mitigated with evidence, not hope.

### Task 2 — Framework-level vitest+jsdom harness + D-12.2 adapter test (commit `5174bf6`)
- Framework had **no test harness** before (D-13) — created `viewmodel-shell/vitest.config.ts` (`environment: "jsdom"`, `include: ["test/**/*.test.ts"]`).
- Added `vitest@^2.1.4` + `jsdom@^25.0.1` devDeps and `"test": "vitest run"`; committed `package-lock.json` for reproducible CI installs (repo convention — every demo frontend commits its lock).
- `viewmodel-shell/test/adapter-seam.test.ts` imports the local source via `.js` NodeNext specifiers (same convention `src/browser.ts` uses), feeds responses through `ViewModelShell.push()` → `processResponse()`, and asserts the Wave 1 relocation actually executes (parity only sees the wire — D-13):
  - **Case A**: `set-local-storage`/`set-session-storage` write to real jsdom `localStorage`/`sessionStorage` via `adapter.storage`.
  - **Case B**: with no `onRedirect`, `BrowserAdapter.prototype.navigate` spy is called with the redirect URL (D-05 step 2 — onRedirect-absent branch resolves to adapter.navigate).
  - **Case C**: with `onRedirect` set, `onRedirect` is called with the URL AND the navigate spy is **not** called (D-04/D-05 precedence, byte-identical to pre-refactor).
  - **Case D (fail-loud, D-06)**: a render-only adapter triggers `onError` with an Error message containing `"storage"` (and nothing written), and separately containing `"navigate"` — T-02-03 silent-capability-failure regression is tested, not assumed.
- **5/5 tests green** (`npx vitest run` exit 0). `npm run build` still exits 0 — `test/` is outside tsconfig `rootDir: src` / `include: ["src/**/*.ts"]`, so the build is unaffected.

### Task 3 — Wire guard + adapter test into CI and run the D-12 dual gate (commit `fc423f1`)
- `.github/workflows/parity.yml`: two new steps added inside the **existing** `parity` job (D-10 — no new workflow file; `Glob .github/workflows/*` returns only `parity.yml`), positioned after "Set up Node" and before "Build .NET demos" / the unchanged "Run cross-backend parity tests" step:
  - `Enforce core platform-agnosticism (AGNOSTIC-03)`: `cd viewmodel-shell && npm install && npm run build && npm run check:core-globals` (also produces `dist/` consumed downstream; fails the build on any denylist hit — T-02-01/T-02-04 mitigated).
  - `Framework adapter-seam tests (D-12.2 relocation proof)`: `cd viewmodel-shell && npx vitest run` (T-02-02 mitigated — parity alone cannot prove the relocation).
- The existing `cd parity && bun run run.ts` step is unchanged.

## D-12 Dual Verification Gate Status

**Both halves were run and are GREEN locally** (this Windows box had .NET 10.0.203, Bun 1.3.13, Node v24.14.0 — full toolchain present, so parity was NOT deferred):

| Gate half | Command | Result |
|-----------|---------|--------|
| (a) AGNOSTIC-03 guard | `npm run check:core-globals` | **exit 0** (and non-zero on reintroduced token, proven) |
| (b) Adapter relocation proof (D-12.2/D-13) | `npx vitest run` | **5/5 passed, exit 0** |
| (1) Parity — wire contract unchanged (D-12.1) | `cd parity && bun run run.ts` | **exit 0 — all 7 fixtures `✓ all backends agree`** |
| Core build | `npm run build` | **exit 0** |

Parity per-fixture (definitive clean run): `tasks` (8 steps, dotnet+bun), `contacts` (11, dotnet+bun), `retro` (9, dotnet+bun), `expenses` (9, dotnet+bun), `helpdesk` (21, dotnet+bun), **`feature-probe` (14 steps, dotnet+bun+node — the redirect + set-storage wire fixture, D-13)**, `reorder` (11, dotnet+bun). `✓ Parity tests passed`.

**The dual gate (D-12) is satisfied — NOT claimed on parity alone.** Both the wire-parity half AND the net-new adapter-relocation half are green, plus the CI-enforced guard.

### Parity environment honesty note (per critical constraint)

Parity DID run and pass locally — but only from a **fully clean process state**. On Windows the parity harness is intermittently flaky between consecutive runs: the harness starts detached `dotnet run` backend grandchildren that its `p.kill()` does not reliably terminate on Windows, and Windows mandatory file locking then makes the *next* run's MSBuild prebuild fail copying the shared `AshleyShrok.ViewModelShell.dll`, or makes a stale SQLite `*-parity-*.db` un-deletable (`MSB3027`/`EBUSY`). This is a **pre-existing Windows-only harness process-lifecycle limitation, NOT a wire-contract regression and NOT caused by this plan** (this plan adds zero parity/backend/.NET code). When all stale backend processes + DB files were cleared, the suite ran clean and exited 0 with all 7 fixtures agreeing (captured above). CI runs parity unconditionally on `ubuntu-latest`, where Linux advisory locking + reliable child reaping eliminate this class of flakiness; the new CI guard/adapter steps gate the same workflow. Self-Check below records the parity half as locally-verified-green (definitive run evidenced) with CI as the unconditional enforcement surface.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Cleared stale Windows backend processes + locked parity DB files to obtain a clean parity run**
- **Found during:** Task 3 (D-12 parity half)
- **Issue:** Repeated parity runs failed in the MSBuild prebuild / SQLite-cleanup phase with `MSB3027`/`MSB3021` ("DLL locked by ViewModelShell/FeatureProbe/Reorder (PID)") and `EBUSY` on `helpdesk-parity-*.db`, because leftover detached backend processes from prior interrupted harness runs (the harness's `p.kill()` does not reap detached `dotnet run` children on Windows) held mandatory file locks. Pre-existing harness limitation; unrelated to this plan's changes.
- **Fix:** Killed stale `ViewModelShell/ContactManager/ExpenseTracker/RetroBoard/HelpDesk/Reorder/FeatureProbe/bun` processes via PowerShell `Stop-Process -Force`, ran `dotnet build-server shutdown`, and removed locked `*parity*.db*` files between attempts. From a fully clean state the suite ran green (exit 0, all 7 fixtures agree). No source/config change required to fix this — purely environmental cleanup.
- **Files modified:** None (process/file cleanup only).
- **Commit:** N/A (no code change).

**2. [Convention] Committed `viewmodel-shell/package-lock.json`**
- **Found during:** Task 2 (`npm install` for new devDeps)
- **Issue:** `npm install` generated a net-new `package-lock.json` in `viewmodel-shell/` (untracked, not gitignored).
- **Fix:** Committed it with Task 2 — the new CI step uses `npm install`, and the repo convention is to commit lockfiles (every `demo/*/frontend/package-lock.json` is tracked). Pins vitest/jsdom for reproducible CI.
- **Files modified:** `viewmodel-shell/package-lock.json` (added).
- **Commit:** `5174bf6`.

## Authentication Gates
None — no auth required during execution.

## Task Commits
1. **Task 1: grep-based core platform-globals guard (AGNOSTIC-03)** — `9b832d3`
2. **Task 2: framework-level vitest+jsdom harness + D-12.2 adapter-seam test** — `5174bf6`
3. **Task 3: wire guard + adapter test into the existing parity CI job; run the D-12 dual gate** — `fc423f1`

## Next Phase Readiness
- **Plan 01-03 (docs, AGNOSTIC-04):** The capability-seam pattern, redirect resolution order (D-05), fail-loud rule (D-06), and the now-CI-enforced "core references zero platform globals" invariant are implemented, verified, and gated — ready to be documented in AGENTS.md + README, including *how* the invariant is enforced (the `check:core-globals` guard + the parity-workflow step).
- **Phase 1 verification gate (D-12):** SATISFIED locally and CI-enforced. AGNOSTIC-01/02 verification half is closed (the relocation is proven to fire, not just wire-unchanged). AGNOSTIC-03 is complete.
- **Phase 2 (UPLOAD-01):** The guard already denylists `XMLHttpRequest` — when the Phase 2 XHR upload binding is added it MUST live in BrowserAdapter (the guard will fail the build if it leaks into core), exactly the enforcement Phase 2 depends on.

## Self-Check: PASSED
- Files verified present: `viewmodel-shell/scripts/check-core-platform-globals.mjs`, `viewmodel-shell/vitest.config.ts`, `viewmodel-shell/test/adapter-seam.test.ts`, `viewmodel-shell/package-lock.json`, `viewmodel-shell/package.json`, `.github/workflows/parity.yml`, `.planning/phases/01-capability-seam-refactor/01-02-SUMMARY.md`.
- Commits verified in git history: `9b832d3`, `5174bf6`, `fc423f1`.
- Guard exit 0 on clean core, non-zero on reintroduced token (negative control executed and restored).
- Adapter test: 5/5 green (`npx vitest run` exit 0). Core build: exit 0.
- Parity half: ran locally and **passed green (exit 0, all 7 fixtures incl. feature-probe agree)** from a clean process state — definitive run evidenced above; honestly noted as Windows-flaky between consecutive runs but NOT deferred (toolchain present) and unconditionally CI-enforced on ubuntu-latest.
